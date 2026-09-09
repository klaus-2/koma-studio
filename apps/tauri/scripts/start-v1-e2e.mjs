import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const v2Root = path.resolve(__dirname, "..");
const repoRoot = path.resolve(v2Root, "..");
const v1Root = process.env.KOMA_V1_ROOT
  ? path.resolve(process.env.KOMA_V1_ROOT)
  : path.join(repoRoot, "electron");
const port = process.env.PLAYWRIGHT_V1_PORT ?? "5174";
const mode = process.env.PLAYWRIGHT_V1_COMMAND ?? "preview";
const args =
  mode === "dev"
    ? [
        "run",
        "dev:vite",
        "--",
        "--host",
        "127.0.0.1",
        "--port",
        port,
        "--strictPort",
      ]
    : [
        "run",
        "preview",
        "--",
        "--host",
        "127.0.0.1",
        "--port",
        port,
        "--strictPort",
      ];
const command = process.platform === "win32" ? "cmd.exe" : "bun";
const commandArgs =
  process.platform === "win32" ? ["/d", "/s", "/c", ["bun", ...args].join(" ")] : args;

const child = spawn(command, commandArgs, {
  cwd: v1Root,
  env: {
    ...process.env,
    VITE_PLAYWRIGHT_WEB_ACCESS: "1",
  },
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
