# Paste into the Railway service terminal (Dashboard -> JOBAI -> ... -> SSH / Console).
# Writes the Bunny copy script into the running container. Run it afterwards with
# the commands in the comment at the bottom.
cd /app/server && mkdir -p scripts && cat > scripts/migrate-recordings-to-bunny.mjs <<'BUNNY_SCRIPT_EOF'
/**
 * One-off: copy screen recordings still on the local volume to Bunny Storage.
 *
 * Plain JS with raw SQL so it runs with bare `node` inside the production
 * container against whatever release is deployed -- including one whose
 * generated Prisma client predates the Bunny columns.
 *
 * Usage (from the server directory, i.e. /app/server on Railway):
 *   node scripts/migrate-recordings-to-bunny.mjs --dry-run
 *   node scripts/migrate-recordings-to-bunny.mjs
 *   node scripts/migrate-recordings-to-bunny.mjs --delete-local
 *
 * If the Bunny columns don't exist yet, a live run adds them exactly as the
 * 20261003000000 migration does, but keeps the default at LOCAL: the release
 * still running writes recordings to the volume, and those must stay
 * migratable. The migration flips the default to BUNNY when the Bunny
 * release deploys.
 *
 * Each upload is sent with Bunny's Checksum header, so Bunny rejects a
 * corrupted copy instead of storing it, and the row only flips to BUNNY after
 * Bunny has accepted the file. Safe to re-run: rows already on Bunny are
 * skipped, and a failed row stays LOCAL (still playable from the volume).
 *
 * Requires BUNNY_STORAGE_ZONE, BUNNY_STORAGE_API_KEY and DATABASE_URL.
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import prismaPkg from "@prisma/client";

const { PrismaClient } = prismaPkg;
const prisma = new PrismaClient();

const STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE;
const API_KEY = process.env.BUNNY_STORAGE_API_KEY;
const HOSTNAME = process.env.BUNNY_STORAGE_HOSTNAME || "storage.bunnycdn.com";
const BASE_PATH = (process.env.BUNNY_STORAGE_BASE_PATH || "screen-recordings").replace(/^\/+|\/+$/g, "");
// Same root ScreenRecordingStorageService reads legacy files from.
const LOCAL_STORAGE_DIR = join(process.cwd(), "storage", "screen-recordings");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const deleteLocal = args.includes("--delete-local");

// Must stay identical to BunnyStorageService.buildPath.
function buildBunnyPath(userId, recordingId, timestamp) {
  const year = timestamp.getUTCFullYear();
  const month = String(timestamp.getUTCMonth() + 1).padStart(2, "0");
  const day = String(timestamp.getUTCDate()).padStart(2, "0");
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "");
  const safeRecordingId = recordingId.replace(/[^a-zA-Z0-9_-]/g, "");
  return `${BASE_PATH}/${year}/${month}/${day}/employee-${safeUserId}/${safeRecordingId}.webm`;
}

async function bunnyColumnsExist() {
  const rows = await prisma.$queryRaw`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'ScreenRecording' AND column_name = 'storageProvider'`;
  return rows.length > 0;
}

async function addBunnyColumns() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "ScreenRecording"
      ADD COLUMN IF NOT EXISTS "storageProvider" TEXT NOT NULL DEFAULT 'LOCAL',
      ADD COLUMN IF NOT EXISTS "bunnyPath" TEXT,
      ADD COLUMN IF NOT EXISTS "uploadStatus" TEXT NOT NULL DEFAULT 'UPLOADED'`);
}

async function uploadToBunny(bunnyPath, body, mimeType) {
  const res = await fetch(`https://${HOSTNAME}/${STORAGE_ZONE}/${bunnyPath}`, {
    method: "PUT",
    headers: {
      AccessKey: API_KEY,
      "Content-Type": mimeType,
      Checksum: createHash("sha256").update(body).digest("hex").toUpperCase(),
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${text}`.trim());
  }
}

function formatBytes(bytes) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

async function main() {
  if (!STORAGE_ZONE || !API_KEY) {
    console.error("BUNNY_STORAGE_ZONE and BUNNY_STORAGE_API_KEY must be set.");
    process.exit(1);
  }

  console.log(`Bunny target: https://${HOSTNAME}/${STORAGE_ZONE}/${BASE_PATH}`);
  console.log(`Local source: ${LOCAL_STORAGE_DIR}`);
  console.log(`Mode: ${dryRun ? "DRY RUN (nothing uploaded or changed)" : "LIVE"}${deleteLocal ? ", deleting local copies" : ""}\n`);

  let hasColumns = await bunnyColumnsExist();
  if (!hasColumns && !dryRun) {
    await addBunnyColumns();
    hasColumns = true;
    console.log("Added storageProvider/bunnyPath/uploadStatus columns (existing rows = LOCAL).\n");
  }

  // Without the columns (dry run only) every row is still on the volume.
  const candidates = hasColumns
    ? await prisma.$queryRaw`
        SELECT "id", "userId", "storagePath", "mimeType", "startedAt" FROM "ScreenRecording"
        WHERE "storageProvider" = 'LOCAL' OR "bunnyPath" IS NULL
        ORDER BY "startedAt" ASC`
    : await prisma.$queryRaw`
        SELECT "id", "userId", "storagePath", "mimeType", "startedAt" FROM "ScreenRecording"
        ORDER BY "startedAt" ASC`;
  console.log(`${candidates.length} recording(s) to migrate.\n`);

  let migrated = 0;
  let missing = 0;
  let failed = 0;
  let bytes = 0;

  for (const [i, rec] of candidates.entries()) {
    const tag = `[${i + 1}/${candidates.length}] ${rec.id}`;
    const localPath = join(LOCAL_STORAGE_DIR, rec.storagePath);
    if (!existsSync(localPath)) {
      console.warn(`${tag} MISSING local file ${rec.storagePath} -- left as LOCAL`);
      missing++;
      continue;
    }

    const bunnyPath = buildBunnyPath(rec.userId, rec.id, new Date(rec.startedAt));
    try {
      const body = await readFile(localPath);
      if (dryRun) {
        console.log(`${tag} would upload ${formatBytes(body.length)} -> ${bunnyPath}`);
      } else {
        await uploadToBunny(bunnyPath, body, rec.mimeType || "video/webm");
        await prisma.$executeRaw`
          UPDATE "ScreenRecording"
          SET "storageProvider" = 'BUNNY', "bunnyPath" = ${bunnyPath}, "uploadStatus" = 'UPLOADED'
          WHERE "id" = ${rec.id}`;
        if (deleteLocal) await rm(localPath, { force: true });
        console.log(`${tag} OK ${formatBytes(body.length)} -> ${bunnyPath}${deleteLocal ? " (local deleted)" : ""}`);
      }
      migrated++;
      bytes += body.length;
    } catch (err) {
      console.error(`${tag} FAILED: ${err.message}`);
      failed++;
    }
  }

  console.log("\n=== Summary ===");
  console.log(`${dryRun ? "Would migrate" : "Migrated"}: ${migrated} (${formatBytes(bytes)})`);
  console.log(`Missing local file: ${missing}`);
  console.log(`Failed: ${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error("Fatal:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
BUNNY_SCRIPT_EOF
echo "Script written: $(wc -l < scripts/migrate-recordings-to-bunny.mjs) lines"
