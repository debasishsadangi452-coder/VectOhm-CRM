import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import { diskStorage } from "multer";

const STORAGE_ROOT = join(process.cwd(), "storage", "resumes");

function safeExtension(originalName: string): string {
  const ext = extname(originalName).toLowerCase();
  return /^\.[a-z0-9]{1,5}$/.test(ext) ? ext : ".pdf";
}

@Injectable()
export class CandidateStorageService {
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

  read(filename: string): Promise<Buffer> {
    return readFile(join(STORAGE_ROOT, filename));
  }

  async delete(filename: string): Promise<void> {
    try {
      await rm(join(STORAGE_ROOT, filename), { force: true });
    } catch {
      // Best-effort cleanup
    }
  }

  // Filenames on disk older than olderThanMs that aren't in referencedFilenames
  // -- backs CandidatesService's orphan-cleanup cron. A resume can legitimately
  // sit unreferenced for a while (uploaded mid-form-fill, e.g. via the public
  // careers/apply flow, before the applicant submits), hence the age cutoff
  // rather than deleting anything unreferenced immediately.
  async listOrphaned(referencedFilenames: Set<string>, olderThanMs: number): Promise<string[]> {
    let entries: string[];
    try {
      entries = await readdir(STORAGE_ROOT);
    } catch {
      return []; // directory doesn't exist yet -- nothing uploaded, nothing orphaned
    }

    const cutoff = Date.now() - olderThanMs;
    const orphaned: string[] = [];
    for (const filename of entries) {
      if (referencedFilenames.has(filename)) continue;
      try {
        const stats = await stat(join(STORAGE_ROOT, filename));
        if (stats.mtimeMs < cutoff) orphaned.push(filename);
      } catch {
        // Raced with a delete elsewhere -- fine, nothing to clean up.
      }
    }
    return orphaned;
  }
}
