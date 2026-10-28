import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import { diskStorage } from "multer";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../../common/types/request-user.type";

const STORAGE_ROOT = join(process.cwd(), "storage", "signature-images");

function safeExtension(originalName: string): string {
  const ext = extname(originalName).toLowerCase();
  return /^\.(png|jpg|jpeg|gif|webp)$/.test(ext) ? ext : ".png";
}

@Injectable()
export class EmailSignatureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  static multerStorage() {
    return diskStorage({
      destination: (_req, _file, cb) => {
        mkdir(STORAGE_ROOT, { recursive: true })
          .then(() => cb(null, STORAGE_ROOT))
          .catch((err) => cb(err as Error, STORAGE_ROOT));
      },
      filename: (_req, file, cb) => {
        cb(null, `${randomUUID()}${safeExtension(file.originalname)}`);
      },
    });
  }

  async get(user: RequestUser) {
    const row = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { emailSignatureHtml: true },
    });
    return { html: row?.emailSignatureHtml ?? null };
  }

  async save(user: RequestUser, html: string | null) {
    const row = await this.prisma.user.update({
      where: { id: user.id },
      data: { emailSignatureHtml: html?.trim() || null },
      select: { emailSignatureHtml: true },
    });
    return { html: row.emailSignatureHtml };
  }

  // Returns the absolute URL the <img> tag should point at. It has to be
  // absolute and publicly reachable: the recipient's mail client loads it with
  // no session and no notion of our origin. Mirrors how the bulk-email engine
  // builds its tracking-pixel URL, including the /api prefix that Caddy
  // strips before the request reaches Nest.
  async addImage(user: RequestUser, file: Express.Multer.File) {
    const image = await this.prisma.emailSignatureImage.create({
      data: {
        ownerId: user.id,
        originalName: file.originalname,
        storagePath: file.filename,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      },
      select: { id: true, originalName: true, sizeBytes: true, createdAt: true },
    });
    return { ...image, url: `${this.publicBaseUrl()}/api/email-signature/image/${image.id}` };
  }

  async listImages(user: RequestUser) {
    const images = await this.prisma.emailSignatureImage.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, originalName: true, sizeBytes: true, createdAt: true },
    });
    const base = this.publicBaseUrl();
    return images.map((i) => ({ ...i, url: `${base}/api/email-signature/image/${i.id}` }));
  }

  // Public by design -- see the model comment. Streams rather than buffers so
  // a logo doesn't sit in memory per request.
  async readImage(id: string) {
    const image = await this.prisma.emailSignatureImage.findUnique({
      where: { id },
      select: { storagePath: true, mimeType: true },
    });
    if (!image) {
      throw new NotFoundException("Image not found");
    }
    const path = join(STORAGE_ROOT, image.storagePath);
    try {
      await stat(path);
    } catch {
      throw new NotFoundException("Image file is missing");
    }
    return { stream: createReadStream(path), mimeType: image.mimeType };
  }

  async removeImage(id: string, user: RequestUser): Promise<void> {
    const image = await this.prisma.emailSignatureImage.findUnique({
      where: { id },
      select: { storagePath: true, ownerId: true },
    });
    if (!image || image.ownerId !== user.id) {
      // Same response either way -- a user shouldn't be able to probe for
      // which image ids exist on other accounts.
      throw new NotFoundException("Image not found");
    }
    await this.deleteFile(image.storagePath);
    await this.prisma.emailSignatureImage.delete({ where: { id } });
  }

  async deleteFile(storagePath: string): Promise<void> {
    try {
      await rm(join(STORAGE_ROOT, storagePath), { force: true });
    } catch {
      // Best-effort; a missing file shouldn't block the DB cleanup.
    }
  }

  private publicBaseUrl(): string {
    const url =
      this.config.get<string>("APP_URL") ??
      this.config.get<string>("CORS_ORIGIN") ??
      "http://localhost:8080";
    return url.replace(/\/$/, "");
  }
}
