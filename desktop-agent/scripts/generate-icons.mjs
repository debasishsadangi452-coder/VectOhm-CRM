// One-off build script (not part of the packaged app) that renders the same
// "V" brand mark used for the website's favicon (see ../../public/favicon.svg)
// into the icon assets Electron/electron-builder need: a multi-resolution
// .ico for the installer/exe/taskbar/shortcuts, and a small PNG for the tray
// icon (base64-inlined directly into main.ts so the running app never
// depends on a separate asset file existing on disk).
import sharp from "sharp";
import pngToIco from "png-to-ico";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const svgPath = path.join(__dirname, "..", "..", "public", "favicon.svg");
const buildDir = path.join(__dirname, "..", "build");
mkdirSync(buildDir, { recursive: true });

const svg = readFileSync(svgPath);

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

async function main() {
  const pngBuffers = await Promise.all(
    ICO_SIZES.map((size) => sharp(svg, { density: size * 4 }).resize(size, size).png().toBuffer()),
  );

  const icoBuffer = await pngToIco(pngBuffers);
  writeFileSync(path.join(buildDir, "icon.ico"), icoBuffer);
  console.log("Wrote build/icon.ico");

  // macOS app icon: electron-builder turns a 1024px PNG into the .icns itself.
  await sharp(svg, { density: 1024 * 2 }).resize(1024, 1024).png().toFile(path.join(buildDir, "icon.png"));
  console.log("Wrote build/icon.png");

  // Tray icon: rendered small and a bit oversized-then-downscaled (via the
  // density trick above) for crisper edges at 16-32px, where most OS trays
  // actually display it.
  const trayPng = await sharp(svg, { density: 128 }).resize(32, 32).png().toBuffer();
  const trayDataUrl = `data:image/png;base64,${trayPng.toString("base64")}`;
  writeFileSync(path.join(buildDir, "tray-icon.dataurl.txt"), trayDataUrl);
  console.log("Wrote build/tray-icon.dataurl.txt (paste into main.ts's TRAY_ICON_DATA_URL)");

  // Window icon: the icon.ico set in package.json's "build.icon" only
  // covers the installer/shortcuts -- each individual BrowserWindow (the
  // login box, the main CRM window) needs its own `icon` option set at
  // creation time, or Electron falls back to its own default icon for
  // whatever's actually on screen/in the taskbar while the window is open.
  // Rendered larger than the tray icon since it's shown bigger (window
  // title bar, Alt-Tab, taskbar).
  const appIconPng = await sharp(svg, { density: 256 * 4 }).resize(256, 256).png().toBuffer();
  const appIconDataUrl = `data:image/png;base64,${appIconPng.toString("base64")}`;
  writeFileSync(path.join(buildDir, "app-icon.dataurl.txt"), appIconDataUrl);
  console.log("Wrote build/app-icon.dataurl.txt (paste into main.ts's APP_ICON_DATA_URL)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
