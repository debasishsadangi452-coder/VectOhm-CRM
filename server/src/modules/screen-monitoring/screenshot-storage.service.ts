import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { join } from "path";

// Local-disk storage, gitignored (see .gitignore -- "server/storage/"). Kept
// behind this thin interface so swapping to S3-compatible object storage
// later is a contained change to this one file, not a rewrite of the module.
const STORAGE_ROOT = join(process.cwd(), "storage", "screenshots");

@Injectable()
export class ScreenshotStorageService {
  async save(buffer: Buffer): Promise<string> {
    await mkdir(STORAGE_ROOT, { recursive: true });
    const filename = `${randomUUID()}.jpg`;
    await writeFile(join(STORAGE_ROOT, filename), buffer);
    return filename;
  }

  read(storagePath: string): Promise<Buffer> {
    return readFile(join(STORAGE_ROOT, storagePath));
  }

  async delete(storagePath: string): Promise<void> {
    try {
      await rm(join(STORAGE_ROOT, storagePath), { force: true });
    } catch {
      // Best-effort -- a missing/already-deleted file shouldn't block the
      // caller's DB cleanup (same non-critical-failure philosophy as
      // auth.service.ts's recordAuthEvent).
    }
  }
}
