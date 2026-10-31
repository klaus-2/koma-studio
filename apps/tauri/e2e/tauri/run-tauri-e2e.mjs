import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

import {
  appRoot,
  checkVenv,
  createRunner,
  isPortFree,
  makeRunId,
  repoRoot,
  runPlaywright,
  sleep,
  viteE2eEnv,
  waitForHttp,
} from "../lib/runner.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const options = {
  flow: args.includes("--flow"),
  wipe: !args.includes("--reuse"),
  stopAfter:
    args.find((arg) => arg.startsWith("--stop-after="))?.slice("--stop-after=".length) ??
    "",
};

const runRoot =
  process.env.E2E_RUN_ROOT ??
  path.join(repoRoot, ".zcode-e2e", "tauri-runs", makeRunId());
const appdataRoot = path.join(runRoot, "appdata");
const webview2Dir = path.join(runRoot, "webview2");

const runner = createRunner({ logPrefix: "tauri-e2e", runRoot });
const { log, fail, cleanup, start } = runner;

const appProcesses = () => {
  const names = ["koma-studio-v2.exe", "KOMA Studio.exe", "KOMA Studio E2E.exe"];
  const running = [];
  for (const name of names) {
    const result = spawnSync(
      "tasklist",
      ["/FI", `IMAGENAME eq ${name}`, "/NH"],
      { encoding: "utf8" },
    );
    if (result.stdout && result.stdout.includes(name)) {
      running.push(name);
    }
  }
  return running;
};

const statMtime = (target) => {
  try {
    return fs.statSync(target).mtimeMs;
  } catch {
    return null;
  }
};

const resolveAppDataDir = async () => {
  const candidates = [
    path.join(appdataRoot, "com.komastudio.desktop.e2e"),
    path.join(appdataRoot, "com.komastudio.desktop"),
    path.join(process.env.APPDATA ?? "", "com.komastudio.desktop.e2e"),
  ];
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
    await sleep(500);
  }
  return null;
};

const main = async () => {
  if (options.wipe) fs.rmSync(runRoot, { recursive: true, force: true });
  for (const directory of [
    runRoot,
    path.join(runRoot, "logs"),
    path.join(runRoot, "report"),
    appdataRoot,
    webview2Dir,
  ]) {
    fs.mkdirSync(directory, { recursive: true });
  }

  const runningApps = appProcesses();
  if (runningApps.length > 0) {
    fail(`E2E_APP_RUNNING: ${runningApps.join(", ")} — close them first`);
  }
  for (const port of [43201, 43202, 43203, 8001]) {
    if (!(await isPortFree(port))) {
      fail(
        port === 8001
          ? "E2E_8001_BUSY: port 8001 is owned by another process; the shell would reuse that backend/models root — NO-GO"
          : `E2E_PORT_BUSY: ${port} is already in use`,
      );
    }
  }

  const venvError = checkVenv();
  if (venvError) fail(venvError);

  const realAppData = path.join(
    process.env.APPDATA ?? "",
    "com.komastudio.desktop",
  );
  const realAppDataMtimeBefore = statMtime(realAppData);

  // Tauri resolves app data through the shell known-folder API, so the
  // isolated identifier lands in the real Roaming dir. It is still a
  // dedicated e2e directory, never the user's com.komastudio.desktop one.
  if (options.wipe) {
    fs.rmSync(
      path.join(process.env.APPDATA ?? "", "com.komastudio.desktop.e2e"),
      { recursive: true, force: true },
    );
  } else {
    // Keep installed models between iterations, but never let an autosave
    // from a previous run preload images into the next one.
    fs.rmSync(
      path.join(process.env.APPDATA ?? "", "com.komastudio.desktop.e2e", "workspace"),
      { recursive: true, force: true },
    );
  }

  process.stdout.write(
    `[tauri-e2e] run root: ${runRoot}\n[tauri-e2e] app data root: ${appdataRoot}\n`,
  );

  const rendererEnv = viteE2eEnv({
    port: 43202,
    localApiUrl: "http://127.0.0.1:8001",
  });

  start(
    process.platform === "win32" ? "cmd.exe" : "bun",
    process.platform === "win32"
      ? ["/d", "/s", "/c", "bun run dev"]
      : ["run", "dev"],
    {
      cwd: appRoot,
      env: { ...process.env, ...rendererEnv },
    },
    "vite.log",
  );

  await waitForHttp("http://127.0.0.1:43202/", 120_000);

  const tauriEnv = {
    ...process.env,
    APPDATA: appdataRoot,
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: "--remote-debugging-port=43203",
    WEBVIEW2_USER_DATA_FOLDER: webview2Dir,
    MINI_BACKEND_WARMUP_DETECTOR: "0",
    // The sidecar inherits this and must accept the Vite dev origin, or the
    // webview's pipeline fetches are rejected by CORS.
    ALLOWED_ORIGINS: "http://127.0.0.1:43202",
    ...rendererEnv,
  };

  const baseConfig = JSON.parse(
    fs.readFileSync(path.join(appRoot, "src-tauri", "tauri.conf.json"), "utf8"),
  );
  const baseWindows = baseConfig.app?.windows;
  if (!Array.isArray(baseWindows) || baseWindows.length === 0) {
    fail("E2E_TAURI_NO_WINDOW: tauri.conf.json declares no window");
  }
  // The CDP flag must ride on the window itself: Tauri passes its own
  // additionalBrowserArgs to WebView2, which replaces the env var.
  const e2eConfig = {
    identifier: "com.komastudio.desktop.e2e",
    productName: "KOMA Studio E2E",
    build: { beforeDevCommand: "", devUrl: "http://127.0.0.1:43202" },
    app: {
      windows: baseWindows.map((window) => ({
        ...window,
        additionalBrowserArgs: "--remote-debugging-port=43203",
      })),
    },
  };
  const tauriConfig = path.join(runRoot, "tauri.e2e.conf.json");
  fs.writeFileSync(tauriConfig, JSON.stringify(e2eConfig, null, 2), "utf8");
  // Spawn bun directly: routing this through cmd.exe re-escapes the config
  // path's quotes and the Tauri CLI then reads a literal quote character.
  start(
    "bun",
    ["run", "tauri", "dev", "--config", tauriConfig],
    { cwd: appRoot, env: tauriEnv },
    "tauri.log",
  );

  await waitForHttp("http://127.0.0.1:43203/json/version", 20 * 60_000);
  log("CDP endpoint ready");

  await waitForHttp("http://127.0.0.1:8001/health", 5 * 60_000);
  log("sidecar healthy on 8001");

  const require = createRequire(path.join(appRoot, "package.json"));
  const { chromium } = require("@playwright/test");
  const browser = await chromium.connectOverCDP("http://127.0.0.1:43203");
  const pages = browser.contexts().flatMap((context) => context.pages());
  let appPage = null;
  for (const page of pages) {
    try {
      await page
        .getByRole("tab", { name: "AIO", exact: true })
        .waitFor({ state: "visible", timeout: 180_000 });
      appPage = page;
      break;
    } catch {
      // try the next page
    }
  }
  if (!appPage) fail("E2E_NO_APP_PAGE: the Tauri window never rendered the dashboard");

  const appDataDir = await resolveAppDataDir();
  if (!appDataDir) fail("E2E_APP_DATA_UNRESOLVED: no isolated app data directory");
  if (appDataDir === realAppData) {
    fail("E2E_REAL_APP_DATA: the test app resolved the user's real app data dir");
  }
  log(`isolated app data: ${appDataDir}`);

  const requests = { backend8001: 0, backend43201: 0 };
  appPage.on("request", (request) => {
    if (request.url().includes("127.0.0.1:8001")) requests.backend8001 += 1;
    if (request.url().includes("127.0.0.1:43201")) requests.backend43201 += 1;
  });

  const downloadPromise = appPage
    .waitForEvent("download", { timeout: 10_000 })
    .catch(() => null);
  await appPage.evaluate(() => {
    const blob = new Blob(["probe"], { type: "text/plain" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = "probe.txt";
    anchor.click();
  });
  const downloadObserved = Boolean(await downloadPromise);

  await sleep(1_500);
  const realAppDataMtimeAfter = statMtime(realAppData);
  const realAppDataUntouched =
    realAppDataMtimeBefore === realAppDataMtimeAfter;
  const pageCount = browser.contexts().reduce(
    (total, context) => total + context.pages().length,
    0,
  );

  const spike = {
    cdp: "http://127.0.0.1:43203",
    pageUrl: appPage.url(),
    pageCount,
    appDataDir,
    appDataUnderRunRoot: appDataDir.startsWith(appdataRoot),
    appDataIsolated: appDataDir !== realAppData,
    realAppDataUntouched,
    sidecarHealthy: true,
    requests,
    downloadObserved,
  };
  fs.writeFileSync(
    path.join(runRoot, "report", "spike.json"),
    JSON.stringify(spike, null, 2),
    "utf8",
  );

  const go =
    pageCount >= 1 &&
    spike.appDataIsolated &&
    appDataDir.endsWith("com.komastudio.desktop.e2e") &&
    realAppDataUntouched &&
    spike.sidecarHealthy;
  if (!go) {
    fail(`SPIKE NO-GO: ${JSON.stringify(spike)}`);
  }
  log(`SPIKE GO: ${JSON.stringify(spike)}`);

  await browser.close().catch(() => undefined);

  if (!options.flow) {
    cleanup();
    return;
  }

  const exitCode = await runPlaywright({
    children: runner.children,
    configPath: path.join(here, "playwright.tauri.config.ts"),
    env: {
      ...process.env,
      E2E_CDP_URL: "http://127.0.0.1:43203",
      E2E_APP_DATA_DIR: appDataDir,
      E2E_RUN_ROOT: runRoot,
      E2E_REPO_ROOT: repoRoot,
      E2E_STOP_AFTER: options.stopAfter,
    },
  });

  cleanup();
  process.exit(exitCode);
};

main().catch((error) => {
  fail(error instanceof Error ? error.stack ?? error.message : String(error));
});
