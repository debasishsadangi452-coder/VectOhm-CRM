import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { createReadStream, type ReadStream } from "node:fs";
import { access, mkdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { diskStorage } from "multer";

// Temporary staging directory for incoming uploads before they are sent to Bunny Storage.
// Files here are unlinked immediately after upload and NEVER permanently stored.
const TEMP_ROOT = join(process.cwd(), "storage", "temp-uploads");

// Legacy local storage root for any existing recordings prior to Bunny Storage migration.
const LEGACY_STORAGE_ROOT = join(process.cwd(), "storage", "screen-recordings");

@Injectable()
export class ScreenRecordingStorageService {
  /**
   * Temporary Multer disk storage. Incoming WebM files are streamed to TEMP_ROOT
   * during HTTP request ingestion and immediately unlinked after being uploaded
   * to Bunny Storage (or on failure).
   */
  static multerStorage() {
    return diskStorage({
      destination: (_req, _file, cb) => {
        mkdir(TEMP_ROOT, { recursive: true })
          .then(() => cb(null, TEMP_ROOT))
          .catch((err) => cb(err as Error, TEMP_ROOT));
      },
      filename: (_req, _file, cb) => cb(null, `rec-tmp-${randomUUID()}.webm`),
    });
  }

  async exists(storagePath: string): Promise<boolean> {
    try {
      await access(join(LEGACY_STORAGE_ROOT, storagePath));
      return true;
    } catch {
      return false;
    }
  }

  size(storagePath: string): Promise<number> {
    return stat(join(LEGACY_STORAGE_ROOT, storagePath)).then((s) => s.size);
  }

  // start/end are inclusive byte offsets, matching HTTP Range semantics
  stream(storagePath: string, start: number, end: number): ReadStream {
    return createReadStream(join(LEGACY_STORAGE_ROOT, storagePath), { start, end });
  }

  async delete(storagePath: string): Promise<void> {
    try {
      await rm(join(LEGACY_STORAGE_ROOT, storagePath), { force: true });
    } catch {
      // Best-effort -- a missing file shouldn't block cleanup.
    }
  }

  /**
   * Helper to safely remove any temporary file.
   */
  async cleanupTemp(filePath: string): Promise<void> {
    if (!filePath) return;
    try {
      await rm(filePath, { force: true });
    } catch {
      // Best effort cleanup
    }
  }
}
