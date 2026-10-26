import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const bundleDir = path.resolve(scriptDir, "..", "src-tauri", "target", "release", "bundle");
const bundleFolders = ["msi", "nsis", "dmg", "deb", "appimage"];
const installerExtensions = new Set([".msi", ".exe", ".dmg", ".deb", ".AppImage"]);

const renamed = [];

for (const folder of bundleFolders) {
  const folderPath = path.join(bundleDir, folder);
  if (!fs.existsSync(folderPath)) continue;

  const entries = fs.readdirSync(folderPath, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const extension = path.extname(entry.name);
    if (!installerExtensions.has(extension)) continue;

    const baseName = entry.name.slice(0, -extension.length);
    if (baseName.endsWith("-tauri")) continue;

    const sourcePath = path.join(folderPath, entry.name);
    const targetPath = path.join(folderPath, `${baseName}-tauri${extension}`);
    if (fs.existsSync(targetPath)) continue;

    fs.renameSync(sourcePath, targetPath);
    const sourceSignature = `${sourcePath}.sig`;
    if (fs.existsSync(sourceSignature)) {
      fs.renameSync(sourceSignature, `${targetPath}.sig`);
    }
    renamed.push(path.relative(bundleDir, targetPath));
  }
}

if (renamed.length > 0) {
  console.log(`[tauri] installer names updated:\n${renamed.map((file) => `  ${file}`).join("\n")}`);
} else {
  console.log("[tauri] no bundle installers needed renaming");
}
