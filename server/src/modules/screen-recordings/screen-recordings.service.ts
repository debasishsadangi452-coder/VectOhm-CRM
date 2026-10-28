import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkSessionsService } from "../work-sessions/work-sessions.service";
import { ScreenRecordingStorageService } from "./screen-recording-storage.service";
import { BunnyStorageService } from "./bunny-storage.service";
import { canViewMonitoringData, isHrDepartment } from "../../common/utils/monitoring-access";
import type { RequestUser } from "../../common/types/request-user.type";
import { SCREEN_RECORDING_RETENTION_DAYS } from "./retention";

const RETENTION_MS = SCREEN_RECORDING_RETENTION_DAYS * 24 * 60 * 60 * 1000;

const recordingUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  department: { select: { id: true, name: true } },
} as const;

export function formatRecordingFilename(firstName: string, lastName: string, startedAt: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = startedAt.getFullYear();
  const m = pad(startedAt.getMonth() + 1);
  const d = pad(startedAt.getDate());
  const hh = pad(startedAt.getHours());
  const mm = pad(startedAt.getMinutes());
  const ss = pad(startedAt.getSeconds());
  const raw = `${firstName}_${lastName}_${y}-${m}-${d}_${hh}-${mm}-${ss}.webm`;
  return raw.replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase();
}

export type PlaybackResult =
  | { kind: "unsatisfiable"; size: number }
  | {
      kind: "stream";
      status: number;
      headers: Record<string, string>;
      stream: NodeJS.ReadableStream;
    };

export interface DownloadResult {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  stream: NodeJS.ReadableStream;
}

const RANGE_CHUNK_BYTES = 2 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 1024 * 1024;

export function parseRange(
  header: string | undefined,
  size: number,
): { start: number; end: number } | "unsatisfiable" | null {
  if (!header || size === 0) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;

  const [, startPart, endPart] = match;
  if (startPart === "") {
    const suffixLength = Number(endPart);
    if (!endPart || !Number.isFinite(suffixLength) || suffixLength === 0) return "unsatisfiable";
    return { start: Math.max(size - suffixLength, 0), end: size - 1 };
  }

  const start = Number(startPart);
  if (start >= size) return "unsatisfiable";
  const end =
    endPart === ""
      ? Math.min(start + RANGE_CHUNK_BYTES - 1, size - 1)
      : Math.min(Number(endPart), size - 1);
  if (end < start) return "unsatisfiable";
  return { start, end };
}

@Injectable()
export class ScreenRecordingsService {
  private readonly logger = new Logger(ScreenRecordingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workSessions: WorkSessionsService,
    private readonly storage: ScreenRecordingStorageService,
    private readonly bunnyStorage: BunnyStorageService,
  ) {}

  async create(
    user: RequestUser,
    file: Express.Multer.File,
    durationSec: number,
    thumbnail?: Express.Multer.File,
  ) {
    try {
      // 403 makes the desktop agent stop recording for the rest of the session.
      const account = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { screenRecordingEnabled: true },
      });
      if (account?.screenRecordingEnabled === false) {
        throw new ForbiddenException("Screen recording is turned off for this account");
      }

      // Recording is always on while the desktop agent is signed in, so a clip
      // is accepted whether or not the employee is clocked in or on a break. It
      // is linked to the open work session when there is one, otherwise stored
      // without (workSessionId is nullable).
      const activeSession = await this.workSessions.getActive(user.id);

      const recordingId = randomUUID();
      const startedAt = new Date();
      const bunnyPath = this.bunnyStorage.buildPath(user.id, recordingId, startedAt);

      // Upload directly from temporary file stream to Bunny Storage
      const fileStream = createReadStream(file.path);
      await this.bunnyStorage.upload(
        bunnyPath,
        fileStream,
        file.mimetype || "video/webm",
        file.size,
      );

      // The thumbnail is a nice-to-have: a failure here must not lose the clip.
      let thumbnailPath: string | null = null;
      if (thumbnail && thumbnail.mimetype === "image/jpeg" && thumbnail.size <= MAX_THUMBNAIL_BYTES) {
        const path = bunnyPath.replace(/\.webm$/, ".jpg");
        try {
          await this.bunnyStorage.upload(path, createReadStream(thumbnail.path), "image/jpeg", thumbnail.size);
          thumbnailPath = path;
        } catch (err) {
          this.logger.warn(`Thumbnail upload failed for recording ${recordingId}: ${(err as Error).message}`);
        }
      }

      // Create database record only after Bunny Storage confirms successful upload
      const recording = await this.prisma.screenRecording.create({
        data: {
          id: recordingId,
          userId: user.id,
          workSessionId: activeSession?.id ?? null,
          storageProvider: "BUNNY",
          storagePath: bunnyPath,
          bunnyPath,
          thumbnailPath,
          uploadStatus: "UPLOADED",
          mimeType: file.mimetype || "video/webm",
          sizeBytes: file.size,
          durationSec,
          startedAt,
        },
      });

      if (Math.random() < 0.05) {
        await this.sweepExpired();
      }

      return { id: recording.id, startedAt: recording.startedAt };
    } finally {
      // Guaranteed cleanup of temporary upload files from backend local disk
      await this.storage.cleanupTemp(file.path);
      if (thumbnail) await this.storage.cleanupTemp(thumbnail.path);
    }
  }

  async list(viewer: RequestUser, filters: { userId?: string; from?: string; to?: string }) {
    const startedAt = this.dateFilter(filters);

    if (filters.userId) {
      const target = await this.getTargetOrThrow(filters.userId);
      if (!canViewMonitoringData(viewer, target)) {
        throw new ForbiddenException("You do not have permission to view this user's recordings");
      }
      return this.prisma.screenRecording.findMany({
        where: { userId: filters.userId, ...(startedAt ? { startedAt } : {}) },
        orderBy: { startedAt: "desc" },
        // Recording is continuous in 15s clips (~2,200 in a 9-hour day), so one
        // employee's day needs far more than the unfiltered 200; still capped
        // so an unbounded range can't pull a whole week of rows at once.
        take: startedAt ? 5000 : 200,
        select: this.listSelect(),
      });
    }

    const isAdmin = viewer.role.name === RoleName.ADMIN;
    const isHR = isHrDepartment(viewer.department?.name);
    const isManager = viewer.role.name === RoleName.MANAGER;
    if (!isAdmin && !isHR && !isManager) {
      throw new ForbiddenException("You do not have permission to view screen recordings");
    }

    const scope = isAdmin || isHR ? {} : { user: { departmentId: viewer.department?.id } };
    return this.prisma.screenRecording.findMany({
      where: { ...scope, ...(startedAt ? { startedAt } : {}) },
      orderBy: { startedAt: "desc" },
      take: 200,
      select: this.listSelect(),
    });
  }

  async getPlayback(id: string, viewer: RequestUser, rangeHeader?: string): Promise<PlaybackResult> {
    const recording = await this.prisma.screenRecording.findUnique({
      where: { id },
      select: {
        id: true,
        storageProvider: true,
        storagePath: true,
        bunnyPath: true,
        mimeType: true,
        sizeBytes: true,
        user: { select: { id: true, email: true, department: { select: { id: true } } } },
      },
    });

    if (!recording) {
      throw new NotFoundException("Recording not found");
    }
    if (!canViewMonitoringData(viewer, recording.user)) {
      throw new ForbiddenException("You do not have permission to view this recording");
    }

    this.logger.log(`Recording playback request: ID=${id}, User=${viewer.email}`);

    // If stored in Bunny Storage (or has bunnyPath)
    if (recording.storageProvider === "BUNNY" || recording.bunnyPath) {
      const path = recording.bunnyPath || recording.storagePath;
      let range: { start: number; end: number } | undefined;

      if (rangeHeader) {
        const parsed = parseRange(rangeHeader, recording.sizeBytes);
        if (parsed === "unsatisfiable") {
          return { kind: "unsatisfiable", size: recording.sizeBytes };
        }
        if (parsed) {
          range = parsed;
        }
      }

      const bunnyResult = await this.bunnyStorage.get(path, range);
      const headers: Record<string, string> = {
        "Content-Type": bunnyResult.headers.contentType || recording.mimeType || "video/webm",
        "Accept-Ranges": bunnyResult.headers.acceptRanges || "bytes",
        "Cross-Origin-Resource-Policy": "cross-origin",
        "Cache-Control": "private, max-age=3600",
      };

      if (bunnyResult.headers.contentRange) {
        headers["Content-Range"] = bunnyResult.headers.contentRange;
      }
      if (bunnyResult.headers.contentLength) {
        headers["Content-Length"] = String(bunnyResult.headers.contentLength);
      }

      return {
        kind: "stream",
        status: bunnyResult.status,
        headers,
        stream: bunnyResult.stream,
      };
    }

    // Legacy fallback: stored on local disk
    const size = await this.storage.size(recording.storagePath);
    const range = parseRange(rangeHeader, size);

    if (range === "unsatisfiable") {
      return { kind: "unsatisfiable", size };
    }

    if (!range) {
      return {
        kind: "stream",
        status: 200,
        headers: {
          "Content-Type": recording.mimeType || "video/webm",
          "Content-Length": String(size),
          "Accept-Ranges": "bytes",
          "Cross-Origin-Resource-Policy": "cross-origin",
          "Cache-Control": "private, max-age=3600",
        },
        stream: this.storage.stream(recording.storagePath, 0, Math.max(size - 1, 0)),
      };
    }

    return {
      kind: "stream",
      status: 206,
      headers: {
        "Content-Type": recording.mimeType || "video/webm",
        "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
        "Content-Length": String(range.end - range.start + 1),
        "Accept-Ranges": "bytes",
        "Cross-Origin-Resource-Policy": "cross-origin",
        "Cache-Control": "private, max-age=3600",
      },
      stream: this.storage.stream(recording.storagePath, range.start, range.end),
    };
  }

  async getForDownload(id: string, viewer: RequestUser): Promise<DownloadResult> {
    const recording = await this.prisma.screenRecording.findUnique({
      where: { id },
      select: {
        id: true,
        storageProvider: true,
        storagePath: true,
        bunnyPath: true,
        mimeType: true,
        sizeBytes: true,
        startedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            department: { select: { id: true } },
          },
        },
      },
    });

    if (!recording) {
      throw new NotFoundException("Recording not found");
    }
    if (!canViewMonitoringData(viewer, recording.user)) {
      throw new ForbiddenException("You do not have permission to download this recording");
    }

    this.logger.log(`Recording download request: ID=${id}, User=${viewer.email}`);

    const filename = formatRecordingFilename(
      recording.user.firstName,
      recording.user.lastName,
      recording.startedAt,
    );

    if (recording.storageProvider === "BUNNY" || recording.bunnyPath) {
      const path = recording.bunnyPath || recording.storagePath;
      const bunnyResult = await this.bunnyStorage.download(path);
      return {
        filename,
        mimeType: recording.mimeType || "video/webm",
        sizeBytes: bunnyResult.headers.contentLength || recording.sizeBytes,
        stream: bunnyResult.stream,
      };
    }

    // Legacy fallback
    const size = await this.storage.size(recording.storagePath);
    return {
      filename,
      mimeType: recording.mimeType || "video/webm",
      sizeBytes: size,
      stream: this.storage.stream(recording.storagePath, 0, Math.max(size - 1, 0)),
    };
  }

  async getThumbnail(id: string, viewer: RequestUser) {
    const recording = await this.prisma.screenRecording.findUnique({
      where: { id },
      select: {
        thumbnailPath: true,
        user: { select: { id: true, email: true, department: { select: { id: true } } } },
      },
    });
    if (!recording) {
      throw new NotFoundException("Recording not found");
    }
    if (!canViewMonitoringData(viewer, recording.user)) {
      throw new ForbiddenException("You do not have permission to view this recording");
    }
    if (!recording.thumbnailPath) {
      throw new NotFoundException("This recording has no thumbnail");
    }
    return (await this.bunnyStorage.get(recording.thumbnailPath)).stream;
  }

  async remove(id: string, viewer: RequestUser): Promise<void> {
    const recording = await this.prisma.screenRecording.findUnique({
      where: { id },
      select: { id: true, storagePath: true, bunnyPath: true, storageProvider: true, thumbnailPath: true },
    });
    if (!recording) {
      throw new NotFoundException("Recording not found");
    }
    const isAdmin = viewer.role.name === RoleName.ADMIN;
    const isHR = isHrDepartment(viewer.department?.name);
    if (!isAdmin && !isHR) {
      throw new ForbiddenException("Only Admin or HR can delete screen recordings");
    }

    if (recording.storageProvider === "BUNNY" || recording.bunnyPath) {
      await this.bunnyStorage.delete(recording.bunnyPath || recording.storagePath);
    }
    if (recording.thumbnailPath) {
      await this.bunnyStorage.delete(recording.thumbnailPath);
    }
    if (recording.storageProvider !== "BUNNY" || (await this.storage.exists(recording.storagePath))) {
      await this.storage.delete(recording.storagePath);
    }

    await this.prisma.screenRecording.delete({ where: { id } });
    this.logger.log(`Recording deleted: ID=${id}, User=${viewer.email}`);
  }

  private listSelect() {
    return {
      id: true,
      startedAt: true,
      durationSec: true,
      sizeBytes: true,
      thumbnailPath: true,
      storageProvider: true,
      bunnyPath: true,
      user: { select: recordingUserSelect },
    } as const;
  }

  private dateFilter(filters: { from?: string; to?: string }) {
    if (!filters.from && !filters.to) return undefined;
    return {
      ...(filters.from ? { gte: new Date(filters.from) } : {}),
      ...(filters.to ? { lte: new Date(filters.to) } : {}),
    };
  }

  private async getTargetOrThrow(userId: string) {
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { department: { select: { id: true } } },
    });
    if (!target) {
      throw new NotFoundException("User not found");
    }
    return target;
  }

  async sweepExpired() {
    const expired = await this.prisma.screenRecording.findMany({
      where: { startedAt: { lt: new Date(Date.now() - RETENTION_MS) } },
      select: { id: true, storagePath: true, bunnyPath: true, storageProvider: true, thumbnailPath: true },
      take: 200,
    });
    if (!expired || expired.length === 0) return;

    await Promise.all(
      expired.map(async (r) => {
        try {
          if (r.storageProvider === "BUNNY" || r.bunnyPath) {
            await this.bunnyStorage.delete(r.bunnyPath || r.storagePath);
          }
          if (r.thumbnailPath) await this.bunnyStorage.delete(r.thumbnailPath);
          await this.storage.delete(r.storagePath);
        } catch (err) {
          this.logger.error(`Error deleting expired recording ${r.id}: ${(err as Error).message}`);
        }
      }),
    );

    await this.prisma.screenRecording.deleteMany({
      where: { id: { in: expired.map((r) => r.id) } },
    });
    this.logger.log(`Retention sweep completed: removed ${expired.length} expired recording(s)`);
  }
}
