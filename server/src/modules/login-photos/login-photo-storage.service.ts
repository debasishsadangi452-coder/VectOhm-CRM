import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { join } from "path";

// Same local-disk-behind-an-interface approach as ScreenshotStorageService
// (see server/src/modules/screen-monitoring/screenshot-storage.service.ts) --
// separate subfolder, same gitignore coverage ("server/storage/").
const STORAGE_ROOT = join(process.cwd(), "storage", "login-photos");

@Injectable()
export class LoginPhotoStorageService {
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
      // caller's DB cleanup.
    }
  }
}
