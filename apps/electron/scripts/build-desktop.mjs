import { execSync } from "node:child_process";

const run = (command, label) => {
  try {
    execSync(command, {
      stdio: "inherit",
      env: process.env,
      shell: true,
    });
  } catch (error) {
    throw new Error(`${label} failed`);
  }
};

const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const desktopOutputDir = `release-desktop/desktop-${timestamp}`;

const main = async () => {
  console.log(`[desktop] output dir: ${desktopOutputDir}`);
  run("bun run build:mini", "build:mini");
  run("bun run build:app", "build:app");
  run("node scripts/ensure-windows-icon.mjs", "ensure-windows-icon");
  run(`npx electron-builder --config.directories.output=${desktopOutputDir}`, "electron-builder");
  run(`node scripts/create-portable-dir.mjs ${desktopOutputDir}`, "create-portable-dir");
  run(`node scripts/build-mini-backend-artifacts.mjs ${desktopOutputDir}`, "build-mini-backend-artifacts");
  run(`node scripts/verify-release.mjs ${desktopOutputDir}`, "verify-release");
  run("node scripts/cleanup-build-caches.mjs", "cleanup-build-caches");
  console.log("[desktop] completed successfully");
};

main().catch((error) => {
  console.error(`[desktop] error: ${error.message}`);
  process.exit(1);
});
