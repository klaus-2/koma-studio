import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const npmCommand = "bun";
const backendCommand = `${npmCommand} run dev:backend`;

// Bootstrap: dev scripts load .env.development (vite) / auth-server/.env.development (tsx --env-file).
// Copy the sanitized examples on first run so fresh clones work out of the box.
const ensureEnvFile = (examplePath, targetPath) => {
  if (fs.existsSync(targetPath) || !fs.existsSync(examplePath)) {
    return;
  }
  fs.copyFileSync(examplePath, targetPath);
  console.log(`[dev] created ${path.relative(rootDir, targetPath)} from the example — adjust secrets/DB if needed.`);
};
ensureEnvFile(path.join(rootDir, ".env.example"), path.join(rootDir, ".env.development"));
// auth-server is a sibling workspace: apps/auth-server
const authServerDir = path.join(rootDir, "..", "auth-server");
ensureEnvFile(
  path.join(authServerDir, ".env.example"),
  path.join(authServerDir, ".env.development"),
);

// Bootstrap: run `bun run mini:install-deps` automatically on the first
// `bun run dev`, so a fresh clone works without the manual README step.
// The marker fast-path inside ensure-mini-venv.mjs makes this a no-op
// (a few milliseconds) whenever dependencies are already installed.
const ensureMiniDeps = () => {
  const markerPath = path.join(rootDir, ".venv-mini", ".koma-mini-deps-marker");
  if (!fs.existsSync(markerPath)) {
    console.log("[dev] First run detected: installing mini-backend Python dependencies (mini:install-deps).");
    console.log("[dev] This can take a few minutes and happens only once.");
  }

  const result = spawnSync(
    process.execPath,
    [path.join(rootDir, "scripts", "ensure-mini-venv.mjs")],
    {
      cwd: rootDir,
      stdio: "inherit",
    },
  );
  if (result.status !== 0) {
    throw new Error(
      "Failed to install mini-backend dependencies (mini:install-deps). Check Python 3.12 and try again.",
    );
  }
};

// VITE_AUTH_DISABLED=true skips the auth-server entirely (local-only mode).
const isTruthyFlag = (value) => ["true", "1", "yes"].includes((value ?? "").trim().toLowerCase());
const readAuthDisabledFlag = () => {
  const fromProcess = process.env.VITE_AUTH_DISABLED;
  if (isTruthyFlag(fromProcess)) {
    return true;
  }
  if (fromProcess !== undefined && fromProcess.trim() !== "") {
    return false;
  }

  // Same file precedence Vite uses in development mode (first hit wins).
  const envCandidates = [
    path.join(rootDir, ".env.development.local"),
    path.join(rootDir, ".env.local"),
    path.join(rootDir, ".env.development"),
    path.join(rootDir, ".env"),
  ];
  for (const envPath of envCandidates) {
    if (!fs.existsSync(envPath)) {
      continue;
    }
    const match = fs
      .readFileSync(envPath, "utf8")
      .match(/^\s*VITE_AUTH_DISABLED\s*=\s*["']?([^"'\r\n#]+)["']?/m);
    if (match) {
      return isTruthyFlag(match[1]);
    }
  }
  return false;
};
const authDisabled = readAuthDisabledFlag();
if (authDisabled) {
  console.log("[dev] VITE_AUTH_DISABLED=true — skipping auth-server (local-only mode).");
}

const services = [
  {
    name: "auth-server",
    command: npmCommand,
    args: ["run", "dev"],
    cwd: authServerDir,
    required: false,
    healthUrl: "http://127.0.0.1:3001/health",
    skip: authDisabled,
  },
  {
    name: "backend-server",
    command: npmCommand,
    args: ["run", "dev:backend"],
    cwd: rootDir,
    required: false,
    healthUrl: "http://127.0.0.1:8001/health",
  },
  {
    name: "vite-electron",
    command: npmCommand,
    args: ["run", "dev:vite"],
    cwd: rootDir,
    required: true,
  },
];

const children = [];
let shuttingDown = false;

const isServiceHealthy = async (url) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        accept: "application/json",
      },
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
};

const killChild = (child) => {
  if (!child || child.killed) {
    return;
  }

  if (process.platform === "win32") {
    // Synchronous so shutdown() cannot exit before the whole process tree
    // is gone — an async taskkill raced the exit timer and left orphaned
    // auth-server/vite/backend processes holding the dev ports.
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
      timeout: 15_000,
    });
    return;
  }

  child.kill("SIGTERM");
};

// Safety net: even after the per-service taskkill /T /F, a python.exe launched
// by the mini-backend (e.g. via CREATE_NEW_PROCESS_GROUP or a detached spawn)
// can outlive its bun parent and keep port 8001 bound. As a last resort, walk
// the parent chain from each top-level child PID and force-kill any surviving
// python.exe that points at packages/mini-backend. ponytail: only fires on
// Windows, only when the first-pass taskkill left a survivor, and uses a
// single wmic round-trip per pid so the cost stays negligible.
const reapOrphanedMiniBackend = () => {
  if (process.platform !== "win32") {
    return;
  }
  const candidates = new Set();
  for (const child of children) {
    if (child && !child.killed) {
      candidates.add(child.pid);
    }
  }
  if (candidates.size === 0) {
    return;
  }
  const wmic = spawnSync(
    "wmic",
    [
      "process",
      "where",
      "Name='python.exe'",
      "get",
      "ProcessId,CommandLine",
      "/format:list",
    ],
    { encoding: "utf8", timeout: 10_000 },
  );
  if (wmic.status !== 0 || !wmic.stdout) {
    return;
  }
  const livePids = new Set();
  for (const block of wmic.stdout.split(/\r?\n\r?\n/)) {
    const cmdMatch = block.match(/CommandLine=(.*)/);
    if (!cmdMatch || !cmdMatch[1].toLowerCase().includes("app.py")) {
      continue;
    }
    const pidMatch = block.match(/ProcessId=(\d+)/);
    if (pidMatch) {
      livePids.add(Number(pidMatch[1]));
    }
  }
  for (const pid of livePids) {
    spawnSync("taskkill", ["/pid", String(pid), "/t", "/f"], {
      stdio: "ignore",
      timeout: 5_000,
    });
  }
};

const shutdown = (exitCode = 0) => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of children) {
    killChild(child);
  }
  reapOrphanedMiniBackend();

  // 2s gives uvicorn time to drain in-flight requests and the taskkill
  // synchronous round-trips to finish walking the tree. The previous 200ms
  // racy window was the reason the next dev-stack launch saw the backend
  // still bound to 8001 and reported "Reusing the existing instance".
  setTimeout(() => {
    process.exit(exitCode);
  }, 2_000);
};

const startService = async ({ name, command, args = [], cwd, required, healthUrl }) => {
  if (healthUrl) {
    const healthy = await isServiceHealthy(healthUrl);
    if (healthy) {
      console.log(`[dev] ${name} is already running at ${healthUrl}. Reusing the existing instance.`);
      return null;
    }
  }

  const child = spawn(command, args, {
    cwd,
    shell: false,
    stdio: "inherit",
    env: process.env,
  });

  children.push(child);

  child.on("error", (error) => {
    console.error(`[dev] Failed to start ${name}: ${error.message}`);
    shutdown(1);
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    if (code === 0) {
      if (required) {
        console.log(`[dev] ${name} finished. Shutting down the dev stack.`);
        shutdown(0);
        return;
      }

      console.warn(`[dev] ${name} finished. The main stack keeps running.`);
      return;
    }

    const signalSuffix = signal ? ` (signal ${signal})` : "";
    const safeCode = typeof code === "number" ? code : 1;
    if (required) {
      console.error(`[dev] ${name} exited with code ${safeCode}${signalSuffix}.`);
      shutdown(safeCode);
      return;
    }

    console.warn(
      `[dev] ${name} exited with code ${safeCode}${signalSuffix}. The main stack keeps running.`,
    );
    if (name === "backend-server") {
      console.warn(
        "[dev] Tip: mini-backend requires Python dependencies (e.g. `python scripts/ensure-mini-deps.py`).",
      );
    }
    if (name === "auth-server") {
      console.warn(
        "[dev] Tip: auth-server requires PostgreSQL running and migrations applied (`cd ../auth-server && bunx drizzle-kit migrate`).",
      );
    }
  });
};

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

const main = async () => {
  ensureMiniDeps();
  for (const service of services) {
    if (service.skip) {
      continue;
    }
    await startService(service);
  }
};

main().catch((error) => {
  console.error(`[dev] Failed to start stack: ${error instanceof Error ? error.message : String(error)}`);
  shutdown(1);
});
