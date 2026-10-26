import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const bundleFolders = ["msi", "nsis", "dmg", "deb", "appimage"];
const installerExtensions = new Set([".msi", ".exe", ".dmg", ".deb", ".AppImage"]);

export function renameTauriInstallers(bundleDir) {
  const renamed = [];

  for (const folder of bundleFolders) {
    const folderPath = path.join(bundleDir, folder);
    if (!fs.existsSync(folderPath)) continue;

    const entries = fs.readdirSync(folderPath, { withFileTypes: true }).toSorted((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (!entry.isFile()) continue;

      const extension = path.extname(entry.name);
      if (!installerExtensions.has(extension)) continue;

      const baseName = entry.name.slice(0, -extension.length);
      if (baseName.endsWith("-tauri")) continue;

      const sourcePath = path.join(folderPath, entry.name);
      const targetPath = path.join(folderPath, `${baseName}-tauri${extension}`);
      // renameSync overwrites a stale -tauri target from a previous run on
      // purpose: a bundle folder must never keep both the plain and the
      // -tauri installer name after this script.
      fs.renameSync(sourcePath, targetPath);
      // Tauri emits a <installer>.sig twin when updater artifacts are enabled;
      // it must follow the rename or a future updater feed would point at a
      // signature name that no longer exists.
      const sourceSignature = `${sourcePath}.sig`;
      if (fs.existsSync(sourceSignature)) {
        fs.renameSync(sourceSignature, `${targetPath}.sig`);
      }
      renamed.push(path.relative(bundleDir, targetPath));
    }
  }

  return renamed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const bundleDir = path.resolve(scriptDir, "..", "src-tauri", "target", "release", "bundle");
  const renamed = renameTauriInstallers(bundleDir);
  if (renamed.length > 0) {
    console.log(`[tauri] installer names updated:\n${renamed.map((file) => `  ${file}`).join("\n")}`);
  } else {
    console.log("[tauri] no bundle installers needed renaming");
  }
}
