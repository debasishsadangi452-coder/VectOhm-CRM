import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import { extname, join } from "node:path";
import { diskStorage } from "multer";

// Same local-disk-behind-an-interface approach as LoginPhotoStorageService --
// separate subfolder under the same gitignored ("server/storage/") root, which
// in production is the mounted Railway volume.
const STORAGE_ROOT = join(process.cwd(), "storage", "deal-documents");

// Only ever used to build the on-disk filename; the original name is kept in
// the database and used for the download, so nothing here is trusted as a
// path fragment.
function safeExtension(originalName: string): string {
  const ext = extname(originalName).toLowerCase();
  return /^\.[a-z0-9]{1,5}$/.test(ext) ? ext : ".pdf";
}

@Injectable()
export class DealDocumentStorageService {
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

  // Proposals are small enough to read into memory for the download rather
  // than range-stream them (contrast the training videos this replaced).
  read(storagePath: string): Promise<Buffer> {
    return readFile(join(STORAGE_ROOT, storagePath));
  }

  async delete(storagePath: string): Promise<void> {
    try {
      await rm(join(STORAGE_ROOT, storagePath), { force: true });
    } catch {
      // Best-effort -- a missing file shouldn't block the caller's DB cleanup.
    }
  }
}
