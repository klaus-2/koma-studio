import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** e2e/lib -> apps/tauri */
export const appRoot = path.resolve(here, "../..");
/** apps/tauri -> repo root */
export const repoRoot = path.resolve(appRoot, "../..");
export const miniRoot = path.join(repoRoot, "packages/mini-backend");

export const makeRunId = () => {
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  return `${stamp}-${Math.random().toString(16).slice(2, 6)}`;
};

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const isPortFree = (port) =>
  new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen({ port, host: "127.0.0.1", exclusive: true });
  });

export const waitForHttp = async (url, timeoutMs) => {
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

/** Process/log scaffolding shared by the harness runners. */
export const createRunner = ({ logPrefix, runRoot }) => {
  const children = [];
  let cleanedUp = false;

  const log = (message) => process.stdout.write(`[${logPrefix}] ${message}\n`);

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    for (const child of children) killChild(child);
    try {
      fs.rmSync(path.join(runRoot, "runner.pid"), { force: true });
    } catch {
      // best effort
    }
  };

  const fail = (message) => {
    process.stderr.write(`[${logPrefix}] ${message}\n`);
    cleanup();
    process.exit(1);
  };

  const start = (command, commandArgs, spawnOptions, logName) => {
    const logsDir = path.join(runRoot, "logs");
    fs.mkdirSync(logsDir, { recursive: true });
    const stream = fs.createWriteStream(path.join(logsDir, logName), {
      flags: "a",
    });
    const child = spawn(command, commandArgs, {
      ...spawnOptions,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.pipe(stream);
    child.stderr.pipe(stream);
    children.push(child);
    return child;
  };

  return { children, log, fail, cleanup, start };
};

/** Path to the mini-backend venv python interpreter. */
export const venvPythonPath = () =>
  path.join(
    appRoot,
    process.platform === "win32"
      ? ".venv-mini/Scripts/python.exe"
      : ".venv-mini/bin/python",
  );

/** Runs `import app` against the mini-backend venv; returns a failure message or null. */
export const checkVenv = () => {
  const python = venvPythonPath();
  if (!fs.existsSync(python)) {
    return `E2E_VENV_MISSING: ${python}`;
  }
  const venvCheck = spawnSync(python, ["-c", "import app"], {
    cwd: miniRoot,
    env: { ...process.env, MINI_BACKEND_WARMUP_DETECTOR: "0" },
    encoding: "utf8",
  });
  if (venvCheck.status !== 0) {
    return `E2E_VENV_BROKEN: ${
      venvCheck.stderr || venvCheck.stdout || "import app failed"
    }`;
  }
  return null;
};

/**
 * Renderer env shared by the dev server and (for the Tauri run) the app
 * shell, so both see the same runtime config.
 */
export const viteE2eEnv = ({ port, localApiUrl }) => ({
  VITE_PORT: String(port),
  VITE_PLAYWRIGHT_WEB_ACCESS: "1",
  VITE_REACT_SCAN: "0",
  VITE_AUTH_DISABLED: "1",
  VITE_AUTH_API_URL: "http://127.0.0.1:3001",
  VITE_LOCAL_API_URL: localApiUrl,
});

/** Spawns the Playwright CLI and resolves with its exit code. */
export const runPlaywright = ({ children, configPath, args = [], env }) =>
  new Promise((resolve) => {
    const playwrightCli = path.join(
      appRoot,
      "node_modules/@playwright/test/cli.js",
    );
    const child = spawn(
      process.execPath,
      [playwrightCli, "test", "-c", configPath, ...args],
      { cwd: repoRoot, stdio: "inherit", env },
    );
    children.push(child);
    child.on("exit", (code) => resolve(code ?? 1));
  });
