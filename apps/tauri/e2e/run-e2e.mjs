import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

import {
  appRoot,
  checkVenv,
  createRunner,
  isPortFree,
  makeRunId,
  miniRoot,
  repoRoot,
  runPlaywright,
  venvPythonPath,
  viteE2eEnv,
  waitForHttp,
} from "./lib/runner.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const options = {
  probe: false,
  reuse: args.includes("--reuse"),
  spec: null,
  stopAfter: null,
};
for (const arg of args) {
  if (arg === "--probe") options.probe = true;
  if (arg.startsWith("--spec=")) options.spec = arg.slice("--spec=".length);
  if (arg.startsWith("--stop-after=")) {
    options.stopAfter = arg.slice("--stop-after=".length);
  }
}

const runRoot =
  process.env.E2E_RUN_ROOT ??
  path.join(repoRoot, ".zcode-e2e", "e2e-runs", makeRunId());
const logsDir = path.join(runRoot, "logs");

const runner = createRunner({ logPrefix: "e2e", runRoot });
const { log, fail, cleanup, start } = runner;

const main = async () => {
  if (!options.reuse) fs.rmSync(runRoot, { recursive: true, force: true });
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

  const venvError = checkVenv();
  if (venvError) fail(venvError);

  const require = createRequire(path.join(appRoot, "package.json"));
  const chromiumPath = require("@playwright/test").chromium.executablePath();
  if (!fs.existsSync(chromiumPath)) {
    fail(`E2E_CHROMIUM_MISSING: ${chromiumPath}`);
  }

  const backendUrl = `http://127.0.0.1:${backendPort}`;
  const viteUrl = `http://127.0.0.1:${vitePort}`;

  start(
    venvPythonPath(),
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
        ...viteE2eEnv({ port: vitePort, localApiUrl: backendUrl }),
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

  const specPath = options.spec
    ? path.join(here, "specs", `${options.spec}.spec.ts`)
    : null;

  const exitCode = await runPlaywright({
    children: runner.children,
    configPath: path.join(here, "playwright.e2e.config.ts"),
    args: specPath ? [path.basename(specPath)] : [],
    env: {
      ...process.env,
      E2E_RUN_ROOT: runRoot,
      E2E_BACKEND_URL: backendUrl,
      E2E_VITE_URL: viteUrl,
      E2E_STOP_AFTER: options.stopAfter ?? "",
    },
  });

  cleanup();
  process.exit(exitCode);
};

main().catch((error) => {
  fail(error instanceof Error ? error.stack ?? error.message : String(error));
});
