import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const distElectronDir = path.join(rootDir, "dist-electron");

const run = (command, label) => {
  try {
    execSync(command, {
      cwd: rootDir,
      stdio: "inherit",
      env: process.env,
      shell: true,
    });
  } catch {
    throw new Error(`${label} failed`);
  }
};

fs.rmSync(distDir, { recursive: true, force: true });
fs.rmSync(distElectronDir, { recursive: true, force: true });

run("bun run build:react", "build:react");
run("bun run build:electron", "build:electron");
