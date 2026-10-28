// electron-builder afterPack hook (macOS only). Without an Apple Developer ID the
// app can't be properly signed, but Apple Silicon Macs refuse to run an app whose
// code signature is broken -- and packaging (Info.plist, resources) breaks the one
// Electron ships with. An ad-hoc signature ("-") makes it valid again; employees
// then approve the app once in System Settings -> Privacy & Security -> Open Anyway.
const { execFileSync } = require("node:child_process");
const path = require("node:path");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", appPath], { stdio: "inherit" });
};
