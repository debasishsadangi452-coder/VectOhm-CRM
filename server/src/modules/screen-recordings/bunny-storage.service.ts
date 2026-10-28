import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Readable } from "node:stream";

export interface BunnyStreamResult {
  status: number;
  headers: {
    contentType?: string;
    contentLength?: number;
    contentRange?: string;
    acceptRanges?: string;
  };
  stream: NodeJS.ReadableStream;
}

@Injectable()
export class BunnyStorageService {
  private readonly logger = new Logger(BunnyStorageService.name);

  constructor(private readonly config: ConfigService) {}

  private get storageZone(): string {
    return this.config.get<string>("BUNNY_STORAGE_ZONE") || process.env.BUNNY_STORAGE_ZONE || "";
  }

  private get apiKey(): string {
    return this.config.get<string>("BUNNY_STORAGE_API_KEY") || process.env.BUNNY_STORAGE_API_KEY || "";
  }

  private get hostname(): string {
    return (
      this.config.get<string>("BUNNY_STORAGE_HOSTNAME") ||
      process.env.BUNNY_STORAGE_HOSTNAME ||
      "storage.bunnycdn.com"
    );
  }

  private get basePath(): string {
    const raw =
      this.config.get<string>("BUNNY_STORAGE_BASE_PATH") ||
      process.env.BUNNY_STORAGE_BASE_PATH ||
      "screen-recordings";
    return raw.replace(/^\/+|\/+$/g, "");
  }

  isConfigured(): boolean {
    return Boolean(this.storageZone && this.apiKey);
  }

  buildPath(userId: string, recordingId: string, timestamp: Date = new Date()): string {
    const year = timestamp.getUTCFullYear();
    const month = String(timestamp.getUTCMonth() + 1).padStart(2, "0");
    const day = String(timestamp.getUTCDate()).padStart(2, "0");
    const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "");
    const safeRecordingId = recordingId.replace(/[^a-zA-Z0-9_-]/g, "");
    return `${this.basePath}/${year}/${month}/${day}/employee-${safeUserId}/${safeRecordingId}.webm`;
  }

  private getEndpoint(bunnyPath: string): string {
    const cleanPath = bunnyPath.replace(/^\/+/, "");
    return `https://${this.hostname}/${this.storageZone}/${cleanPath}`;
  }

  async upload(
    bunnyPath: string,
    body: Buffer | NodeJS.ReadableStream,
    mimeType = "video/webm",
    contentLength?: number,
  ): Promise<{ success: boolean; sizeBytes?: number }> {
    if (!this.isConfigured()) {
      this.logger.error("Bunny Storage upload attempted but credentials are not configured");
      throw new InternalServerErrorException(
        "Bunny Storage is not configured (BUNNY_STORAGE_ZONE and BUNNY_STORAGE_API_KEY required)",
      );
    }

    const url = this.getEndpoint(bunnyPath);
    this.logger.log(`Bunny upload started: ${bunnyPath}`);

    try {
      const headers: Record<string, string> = {
        AccessKey: this.apiKey,
        "Content-Type": mimeType,
      };
      if (contentLength && contentLength > 0) {
        headers["Content-Length"] = String(contentLength);
      }

      const requestInit: RequestInit = {
        method: "PUT",
        headers,
        body: body as unknown as BodyInit,
      };

      if (!(body instanceof Buffer)) {
        // Required in Node 18+ when streaming a Request body
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (requestInit as any).duplex = "half";
      }

      const res = await fetch(url, requestInit);

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        this.logger.error(`Bunny upload failed: ${bunnyPath} - HTTP ${res.status}: ${errorText}`);
        throw new BadGatewayException(`Bunny Storage upload failed: HTTP ${res.status}`);
      }

      this.logger.log(`Bunny upload completed: ${bunnyPath} (${contentLength ?? "unknown"} bytes)`);
      return { success: true, sizeBytes: contentLength };
    } catch (err) {
      if (err instanceof BadGatewayException || err instanceof InternalServerErrorException) {
        throw err;
      }
      const message = (err as Error).message || String(err);
      this.logger.error(`Bunny upload failed: ${bunnyPath} - ${message}`);
      throw new BadGatewayException(`Bunny Storage upload error: ${message}`);
    }
  }

  async get(bunnyPath: string, range?: { start: number; end: number }): Promise<BunnyStreamResult> {
    if (!this.isConfigured()) {
      throw new InternalServerErrorException("Bunny Storage is not configured");
    }

    const url = this.getEndpoint(bunnyPath);
    const headers: Record<string, string> = {
      AccessKey: this.apiKey,
    };

    if (range) {
      headers["Range"] = `bytes=${range.start}-${range.end}`;
    }

    const res = await fetch(url, {
      method: "GET",
      headers,
    });

    if (res.status === 404) {
      throw new NotFoundException("Recording file not found in storage");
    }

    if (!res.ok && res.status !== 206) {
      const errText = await res.text().catch(() => "");
      this.logger.error(`Bunny fetch failed for ${bunnyPath}: HTTP ${res.status} ${errText}`);
      throw new BadGatewayException(`Storage retrieval failed: HTTP ${res.status}`);
    }

    if (!res.body) {
      throw new BadGatewayException("Empty response body from storage");
    }

    const contentType = res.headers.get("content-type") || "video/webm";
    const contentLength = res.headers.get("content-length")
      ? Number(res.headers.get("content-length"))
      : undefined;
    const contentRange = res.headers.get("content-range") || undefined;
    const acceptRanges = res.headers.get("accept-ranges") || "bytes";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodeStream = Readable.fromWeb(res.body as any);

    return {
      status: res.status,
      headers: {
        contentType,
        contentLength,
        contentRange,
        acceptRanges,
      },
      stream: nodeStream,
    };
  }

  async download(bunnyPath: string): Promise<BunnyStreamResult> {
    return this.get(bunnyPath);
  }

  async delete(bunnyPath: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    const url = this.getEndpoint(bunnyPath);
    try {
      const res = await fetch(url, {
        method: "DELETE",
        headers: {
          AccessKey: this.apiKey,
        },
      });

      if (res.ok || res.status === 404) {
        this.logger.log(`Bunny delete completed: ${bunnyPath}`);
        return true;
      }
      const errText = await res.text().catch(() => "");
      this.logger.error(`Bunny delete failed: ${bunnyPath} - HTTP ${res.status}: ${errText}`);
      return false;
    } catch (err) {
      this.logger.error(`Bunny delete failed: ${bunnyPath} - ${(err as Error).message}`);
      return false;
    }
  }

  async exists(bunnyPath: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    const url = this.getEndpoint(bunnyPath);
    try {
      const res = await fetch(url, {
        method: "HEAD",
        headers: {
          AccessKey: this.apiKey,
        },
      });
      return res.status === 200;
    } catch {
      return false;
    }
  }
}
