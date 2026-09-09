#!/usr/bin/env node
/**
 * Cross-platform runner for scripts that must execute inside .venv-mini.
 *
 * Usage:
 *   node scripts/run-mini-python.mjs scripts/harden-mini-backend.py [args...]
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";
const venvPython = isWindows
  ? path.join(rootDir, ".venv-mini", "Scripts", "python.exe")
  : path.join(rootDir, ".venv-mini", "bin", "python");

if (!fs.existsSync(venvPython)) {
  console.error(`Missing ${path.relative(rootDir, venvPython)}. Run \`bun run mini:install-deps\` first.`);
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/run-mini-python.mjs <script.py> [args...]");
  process.exit(1);
}

const result = spawnSync(venvPython, args, { stdio: "inherit", cwd: rootDir });
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
