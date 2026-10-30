import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, "..");
const repoRoot = path.resolve(appRoot, "../..");
const miniRoot = path.join(repoRoot, "packages/mini-backend");

const args = process.argv.slice(2);
const options = {
  probe: false,
  wipe: !args.includes("--reuse"),
  spec: null,
  stopAfter: null,
};
for (const arg of args) {
  if (arg === "--probe") options.probe = true;
  if (arg === "--wipe") options.wipe = true;
  if (arg.startsWith("--spec=")) options.spec = arg.slice("--spec=".length);
  if (arg.startsWith("--stop-after=")) {
    options.stopAfter = arg.slice("--stop-after=".length);
  }
}

const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
const runId = `${stamp}-${Math.random().toString(16).slice(2, 6)}`;
const runRoot =
  process.env.E2E_RUN_ROOT ??
  path.join(repoRoot, ".zcode-e2e", "e2e-runs", runId);
const logsDir = path.join(runRoot, "logs");

const children = [];
let cleanedUp = false;

const log = (message) => {
  process.stdout.write(`[e2e] ${message}\n`);
};

const fail = (message) => {
  process.stderr.write(`[e2e] ${message}\n`);
  cleanup();
  process.exit(1);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isPortFree = (port) =>
  new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen({ port, host: "127.0.0.1", exclusive: true });
  });

const waitForHttp = async (url, timeoutMs) => {
  const deadline = Date.now() + timeoutMs;
  let lastError = "timeout";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(5_000),
      });
      if (response.ok) return response;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError}`);
};

const killChild = (child) => {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
    });
    return;
  }
  child.kill("SIGTERM");
};

function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;
  for (const child of children) killChild(child);
  try {
    fs.rmSync(path.join(runRoot, "runner.pid"), { force: true });
  } catch {
    // best effort
  }
}

const start = (command, commandArgs, spawnOptions, logName) => {
  const logStream = fs.createWriteStream(path.join(logsDir, logName), {
    flags: "a",
  });
  const child = spawn(command, commandArgs, {
    ...spawnOptions,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.pipe(logStream);
  child.stderr.pipe(logStream);
  children.push(child);
  return child;
};

const main = async () => {
  if (options.wipe) fs.rmSync(runRoot, { recursive: true, force: true });
  for (const directory of [
    runRoot,
    logsDir,
    path.join(runRoot, "report"),
    path.join(runRoot, "report", "screenshots"),
    path.join(runRoot, "models"),
    path.join(runRoot, "workspace"),
    path.join(runRoot, "exports"),
  ]) {
    fs.mkdirSync(directory, { recursive: true });
  }

  const pidFile = path.join(runRoot, "runner.pid");
  if (fs.existsSync(pidFile)) {
    const previous = Number(fs.readFileSync(pidFile, "utf8"));
    if (Number.isInteger(previous) && previous > 0) {
      try {
        process.kill(previous, 0);
        fail(`E2E_STALE_RUNNER: PID ${previous} is still alive`);
      } catch {
        fs.rmSync(pidFile, { force: true });
      }
    }
  }
  fs.writeFileSync(pidFile, String(process.pid), "utf8");

  const portBase = Number(process.env.E2E_PORT_BASE ?? 43100);
  const backendPort = portBase + 1;
  const vitePort = portBase + 2;
  for (const port of [backendPort, vitePort]) {
    if (!(await isPortFree(port))) {
      fail(`E2E_PORT_BUSY: ${port} is already in use`);
    }
  }

  const python = path.join(
    appRoot,
    process.platform === "win32"
      ? ".venv-mini/Scripts/python.exe"
      : ".venv-mini/bin/python",
  );
  if (!fs.existsSync(python)) {
    fail(`E2E_VENV_MISSING: ${python}`);
  }
  const venvCheck = spawnSync(python, ["-c", "import app"], {
    cwd: miniRoot,
    env: { ...process.env, MINI_BACKEND_WARMUP_DETECTOR: "0" },
    encoding: "utf8",
  });
  if (venvCheck.status !== 0) {
    fail(
      `E2E_VENV_BROKEN: ${venvCheck.stderr || venvCheck.stdout || "import app failed"}`,
    );
  }

  const require = createRequire(path.join(appRoot, "package.json"));
  const chromiumPath = require("@playwright/test").chromium.executablePath();
  if (!fs.existsSync(chromiumPath)) {
    fail(`E2E_CHROMIUM_MISSING: ${chromiumPath}`);
  }

  const backendUrl = `http://127.0.0.1:${backendPort}`;
  const viteUrl = `http://127.0.0.1:${vitePort}`;

  start(
    python,
    ["app.py"],
    {
      cwd: miniRoot,
      env: {
        ...process.env,
        KOMA_MODELS_ROOT: path.join(runRoot, "models"),
        PORT: String(backendPort),
        NODE_ENV: "development",
        ALLOWED_ORIGINS: viteUrl,
        MINI_BACKEND_WARMUP_DETECTOR: "0",
        PYTHONUNBUFFERED: "1",
      },
    },
    "backend.log",
  );

  start(
    process.platform === "win32" ? "cmd.exe" : "bun",
    process.platform === "win32"
      ? ["/d", "/s", "/c", "bun run dev"]
      : ["run", "dev"],
    {
      cwd: appRoot,
      env: {
        ...process.env,
        VITE_PORT: String(vitePort),
        VITE_PLAYWRIGHT_WEB_ACCESS: "1",
        VITE_REACT_SCAN: "0",
        VITE_AUTH_DISABLED: "1",
        VITE_AUTH_API_URL: "http://127.0.0.1:3001",
        VITE_LOCAL_API_URL: backendUrl,
      },
    },
    "vite.log",
  );

  await waitForHttp(`${backendUrl}/health`, 120_000);
  const entry = await waitForHttp(`${viteUrl}/e2e/index.html`, 120_000);
  const html = await entry.text();
  if (!html.includes('id="root"')) {
    fail("E2E_ENTRY_INVALID: /e2e/index.html has no #root");
  }

  log(`run root: ${runRoot}`);
  log(`backend: ${backendUrl}`);
  log(`vite: ${viteUrl}`);

  if (options.probe) {
    log("PROBE OK");
    cleanup();
    return;
  }

  const playwrightCli = path.join(
    appRoot,
    "node_modules/@playwright/test/cli.js",
  );
  const specPath = options.spec
    ? path.join(here, "specs", `${options.spec}.spec.ts`)
    : null;
  const playwrightArgs = [
    playwrightCli,
    "test",
    "-c",
    path.join(here, "playwright.e2e.config.ts"),
    ...(specPath ? [path.basename(specPath)] : []),
  ];

  const exitCode = await new Promise((resolve) => {
    const child = spawn(process.execPath, playwrightArgs, {
      cwd: repoRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        E2E_RUN_ROOT: runRoot,
        E2E_BACKEND_URL: backendUrl,
        E2E_VITE_URL: viteUrl,
        E2E_STOP_AFTER: options.stopAfter ?? "",
      },
    });
    children.push(child);
    child.on("exit", (code) => resolve(code ?? 1));
  });

  cleanup();
  process.exit(exitCode);
};

main().catch((error) => {
  fail(error instanceof Error ? error.stack ?? error.message : String(error));
});
