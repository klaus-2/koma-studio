#!/usr/bin/env node
// Runs a Python script using the .venv-mini interpreter (venv ensured first).
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const venvDir = path.join(rootDir, ".venv-mini");
const pythonBin = process.platform === "win32"
  ? path.join(venvDir, "Scripts", "python.exe")
  : path.join(venvDir, "bin", "python");

const script = process.argv[2];
if (!script) {
  console.error("Usage: node scripts/run-python-script.mjs <script.py> [args...]");
  process.exit(1);
}

const ensure = spawnSync(process.execPath, [path.join(__dirname, "ensure-mini-venv.mjs")], { stdio: "inherit" });
if (ensure.status !== 0) process.exit(ensure.status ?? 1);
if (!existsSync(pythonBin)) {
  console.error(`Python venv not found at ${venvDir}`);
  process.exit(1);
}

const child = spawn(pythonBin, [script, ...process.argv.slice(3)], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
