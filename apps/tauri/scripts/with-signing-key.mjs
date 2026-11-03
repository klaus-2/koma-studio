import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  hasExportedSigningKey,
  resolveLocalSigningKeyPath,
  updaterSigningKeyPath,
} from "./lib/tauri-signing.mjs";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("[with-signing-key] usage: node scripts/with-signing-key.mjs <command> [args...]");
  process.exit(1);
}

const truthy = (value) => ["1", "true", "yes"].includes(String(value ?? "").trim().toLowerCase());

const env = { ...process.env };
let finalArgs = args;

if (truthy(process.env.KOMA_TAURI_SKIP_UPDATER_ARTIFACTS)) {
  const overlayPath = path.join(os.tmpdir(), "koma-tauri-skip-updater-overlay.json");
  fs.writeFileSync(overlayPath, JSON.stringify({ bundle: { createUpdaterArtifacts: false } }));
  finalArgs = [...args, "--config", overlayPath];
  console.log("[with-signing-key] KOMA_TAURI_SKIP_UPDATER_ARTIFACTS set: updater artifacts disabled for this build");
} else if (!hasExportedSigningKey()) {
  const keyPath = resolveLocalSigningKeyPath();
  if (!keyPath) {
    console.error(
      `[with-signing-key] updater signing key not found at ${updaterSigningKeyPath()}.\n` +
      "Generate it with `bunx tauri signer generate -w <path>` or export " +
      "TAURI_SIGNING_PRIVATE_KEY(_PATH); tauri build cannot produce updater artifacts without it.",
    );
    process.exit(1);
  }
  env.TAURI_SIGNING_PRIVATE_KEY_PATH = keyPath;
  console.log(`[with-signing-key] signing updater artifacts with ${keyPath}`);
}

const result = spawnSync(finalArgs[0], finalArgs.slice(1), {
  stdio: "inherit",
  shell: process.platform === "win32",
  env,
});
if (result.error) {
  console.error(`[with-signing-key] failed to spawn "${finalArgs[0]}": ${result.error.message}`);
}
process.exit(result.status ?? 1);
