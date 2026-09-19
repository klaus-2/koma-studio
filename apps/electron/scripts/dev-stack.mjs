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
    port: 3001,
    skip: authDisabled,
  },
  {
    name: "backend-server",
    command: npmCommand,
    args: ["run", "dev:backend"],
    cwd: rootDir,
    required: false,
    healthUrl: "http://127.0.0.1:8001/health",
    port: 8001,
  },
  {
    name: "vite-electron",
    command: npmCommand,
    args: ["run", "dev:vite"],
    cwd: rootDir,
    required: true,
    healthUrl: "http://127.0.0.1:5173/",
    port: 5173,
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

// ── Stale-instance recovery ────────────────────────────────────────────────
// CTRL+C in the user's terminal kills bun and this supervisor before our
// SIGINT handlers run (Windows delivers CTRL_C_EVENT to the process group,
// and the `bun run` wrapper above us does not forward it), so child services
// survive and the NEXT launch sees a healthy healthUrl and "reuses" the
// stale instance — hiding processes nobody's terminal controls anymore.
//
// Recovery: on startup, any dev-stack-owned port that is still listening
// while the stack claims no owner (no marker file) is a leftover from a
// dead stack — kill its listener tree. The marker (pidfile) records who
// owns the stack right now: a LIVE stack never gets its services killed,
// even if its marker write races (PID re-check guards that).
const stackMarkerPath = path.join(rootDir, "node_modules", ".cache", "koma-dev-stack.json");
const OWNED_PORTS = services.map((service) => service.port).filter(Boolean);

const getPortListenerPid = (port) => {
  const result = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess`,
    ],
    { encoding: "utf8", timeout: 10_000 },
  );
  const pid = Number.parseInt((result.stdout ?? "").trim(), 10);
  return Number.isInteger(pid) && pid > 0 ? pid : null;
};

const isPidAlive = (pid) => {
  const result = spawnSync("tasklist", ["/FI", `PID eq ${pid}`, "/NH"], {
    encoding: "utf8",
    timeout: 10_000,
  });
  return (result.stdout ?? "").includes(String(pid));
};

const recoverStaleInstances = () => {
  if (process.platform !== "win32") {
    return;
  }

  let ownerPid = null;
  try {
    if (fs.existsSync(stackMarkerPath)) {
      const parsed = JSON.parse(fs.readFileSync(stackMarkerPath, "utf8"));
      if (Number.isInteger(parsed?.pid) && parsed.pid > 0) {
        ownerPid = parsed.pid;
      }
    }
  } catch {
    // Corrupt marker = no trustworthy owner; treated as none below.
  }

  // Distinguish a LIVE stack (owned, keep everything) from a DEAD one
  // (marker left behind by CTRL+C — clear it and recover the ports).
  if (ownerPid !== null && ownerPid !== process.pid) {
    if (isPidAlive(ownerPid)) {
      console.log(
        `[dev] Another dev stack (pid ${ownerPid}) is already managing these services — recovering nothing.`,
      );
      return;
    }
    console.log(`[dev] Clearing stale dev-stack marker (owner pid ${ownerPid} is gone).`);
  }
  try {
    fs.mkdirSync(path.dirname(stackMarkerPath), { recursive: true });
    fs.writeFileSync(
      stackMarkerPath,
      JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
    );
  } catch {
    // node_modules/.cache may not exist yet; recovery still proceeds.
  }

  const serviceByPort = new Map(
    services.filter((service) => service.port).map((service) => [service.port, service.name]),
  );
  for (const port of OWNED_PORTS) {
    const pid = getPortListenerPid(port);
    if (!pid || pid === process.pid || !isPidAlive(pid)) {
      continue;
    }
    const commandLine = spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `(Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}').CommandLine`,
      ],
      { encoding: "utf8", timeout: 10_000 },
    );
    const line = (commandLine.stdout ?? "").trim();
    // Only kill things that look like this repo's dev tooling — never an
    // unrelated program that happens to bind the same port.
    const looksOurs =
      /koma/i.test(line) ||
      /tsx|vite|uvicorn|bun\b|node\b|python/i.test(line);
    if (!looksOurs) {
      console.warn(
        `[dev] Port ${port} is held by pid ${pid} which does not look like koma dev tooling — leaving it alone.`,
      );
      continue;
    }
    console.log(
      `[dev] Killing stale ${serviceByPort.get(port) ?? "service"} on port ${port} (pid ${pid}) — leftover from a previous CTRL+C.`,
    );
    spawnSync("taskkill", ["/pid", String(pid), "/t", "/f"], {
      stdio: "ignore",
      timeout: 15_000,
    });
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
  // wmic was removed on recent Windows 11 builds; use the CIM cmdlet.
  const powershell = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | ForEach-Object { \"$($_.ProcessId)|$($_.CommandLine)\" }",
    ],
    { encoding: "utf8", timeout: 10_000 },
  );
  if (powershell.status !== 0 || !powershell.stdout) {
    return;
  }
  const livePids = new Set();
  for (const line of powershell.stdout.split(/\r?\n/)) {
    const separator = line.indexOf("|");
    if (separator < 0) {
      continue;
    }
    const pid = line.slice(0, separator).trim();
    const commandLine = line.slice(separator + 1);
    if (!/^\d+$/.test(pid) || !commandLine.toLowerCase().includes("app.py")) {
      continue;
    }
    livePids.add(pid);
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
  try {
    fs.rmSync(stackMarkerPath, { force: true });
  } catch {
    // Marker cleanup is best-effort; the PID re-check covers leftovers.
  }
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
// CTRL_BREAK reaches process groups that CTRL_C does not (children spawned
// in their own process group) — handle it like an interrupt.
process.on("SIGBREAK", () => shutdown(0));
// Last resort when the process dies without shutdown() having run (uncaught
// exception, hard kill from a parent that skipped signal forwarding): the
// exit handler still fires on those paths, and killChild is synchronous.
process.on("exit", () => {
  if (!shuttingDown) {
    for (const child of children) {
      killChild(child);
    }
    reapOrphanedMiniBackend();
  }
  try {
    fs.rmSync(stackMarkerPath, { force: true });
  } catch {
    // best effort
  }
});

const main = async () => {
  recoverStaleInstances();
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
