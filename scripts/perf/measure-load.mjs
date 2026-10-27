import { existsSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const require = createRequire(
  fileURLToPath(new URL("../../apps/tauri/package.json", import.meta.url)),
);
const { chromium } = require("playwright");

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (arg.startsWith("--")) {
    const [key, value] = arg.slice(2).split("=");
    args.set(key, value ?? "true");
  }
}

const root = path.resolve(args.get("dir") ?? "apps/tauri/dist");
const label = args.get("label") ?? "run";
const route = args.get("route") ?? "/";
const runs = Number(args.get("runs") ?? 2);
const outDir = path.resolve(args.get("out") ?? ".zcode-e2e/perf");
const waitForText = args.get("wait-text") ?? "";
const profiles = (args.get("profiles") ?? "mobile,desktop").split(",");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".txt": "text/plain; charset=utf-8",
};

const compressible = (ext) =>
  [".html", ".js", ".mjs", ".css", ".json", ".svg", ".txt"].includes(ext);

const fileCache = new Map();

const resolveFile = (urlPath) => {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  let filePath = path.join(root, decoded);
  if (!filePath.startsWith(root)) return null;
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  } else if (!existsSync(filePath) && !path.extname(filePath)) {
    filePath = path.join(filePath, "index.html");
  }
  return existsSync(filePath) && statSync(filePath).isFile() ? filePath : null;
};

const readBuffer = (filePath) => {
  const stat = statSync(filePath);
  const cached = fileCache.get(filePath);
  if (cached && cached.mtimeMs === stat.mtimeMs) return cached;
  const raw = require("node:fs").readFileSync(filePath);
  const ext = path.extname(filePath);
  const entry = {
    mtimeMs: stat.mtimeMs,
    raw,
    brotli: compressible(ext) ? zlib.brotliCompressSync(raw) : null,
    gzip: compressible(ext) ? zlib.gzipSync(raw) : null,
    ext,
  };
  fileCache.set(filePath, entry);
  return entry;
};

const server = http.createServer((req, res) => {
  const filePath = resolveFile(new URL(req.url, "http://localhost").pathname);
  if (!filePath) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
    return;
  }
  const entry = readBuffer(filePath);
  const accepts = req.headers["accept-encoding"] ?? "";
  const isHead = req.method === "HEAD";
  const headers = {
    "content-type": MIME[entry.ext] ?? "application/octet-stream",
    "cache-control": "no-store",
    vary: "accept-encoding",
  };
  let body = entry.raw;
  if (entry.brotli && /\bbr\b/.test(accepts)) {
    headers["content-encoding"] = "br";
    body = entry.brotli;
  } else if (entry.gzip && /\bgzip\b/.test(accepts)) {
    headers["content-encoding"] = "gzip";
    body = entry.gzip;
  }
  headers["content-length"] = body.length;
  res.writeHead(200, headers);
  if (isHead) {
    res.end();
    return;
  }
  res.end(body);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}${route}`;

const PROFILES = {
  desktop: {
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    cpu: 1,
    network: { latency: 150, download: (1.6 * 1024 * 1024) / 8, upload: (750 * 1024) / 8 },
  },
  mobile: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    cpu: 4,
    network: { latency: 150, download: (1.6 * 1024 * 1024) / 8, upload: (750 * 1024) / 8 },
  },
};

const INIT_SCRIPT = () => {
  const state = {
    lcp: 0,
    lcpElement: null,
    lcpUrl: null,
    cls: 0,
    longTasks: [],
    fcp: 0,
  };
  window.__komaPerf = state;

  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      state.fcp = entry.startTime;
    }
  }).observe({ type: "paint", buffered: true });

  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      state.lcp = entry.startTime;
      state.lcpUrl = entry.url || null;
      const element = entry.element;
      state.lcpElement = element
        ? {
            tag: element.tagName,
            className: typeof element.className === "string" ? element.className.slice(0, 120) : null,
            src: element.currentSrc || element.src || null,
            text: (element.textContent ?? "").trim().slice(0, 80) || null,
          }
        : null;
    }
  }).observe({ type: "largest-contentful-paint", buffered: true });

  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!entry.hadRecentInput) state.cls += entry.value;
    }
  }).observe({ type: "layout-shift", buffered: true });

  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      state.longTasks.push({
        start: entry.startTime,
        duration: entry.duration,
        attribution: (entry.attribution ?? []).map((item) => ({
          name: item.name,
          containerType: item.containerType,
          containerName: item.containerName,
        })),
      });
    }
  }).observe({ type: "longtask", buffered: true });
};

const collect = (page) =>
  page.evaluate(() => {
    const state = window.__komaPerf ?? {};
    const nav = performance.getEntriesByType("navigation")[0];
    const resources = performance.getEntriesByType("resource");
    const groups = {};
    for (const resource of resources) {
      const url = new URL(resource.name);
      const ext = url.pathname.slice(url.pathname.lastIndexOf(".")).toLowerCase();
      const key =
        ext === ".js" || ext === ".mjs"
          ? "js"
          : ext === ".css"
            ? "css"
            : [".woff", ".woff2", ".ttf", ".otf"].includes(ext)
              ? "font"
              : [".webp", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".avif", ".ico"].includes(ext)
                ? "image"
                : ext === ".mp4" || ext === ".webm"
                  ? "video"
                  : "other";
      groups[key] ??= { count: 0, transfer: 0, decoded: 0 };
      groups[key].count += 1;
      groups[key].transfer += resource.transferSize ?? 0;
      groups[key].decoded += resource.decodedBodySize ?? 0;
    }
    const longTasks = state.longTasks ?? [];
    const jsFiles = resources
      .filter((resource) => /\.m?js$/.test(new URL(resource.name).pathname))
      .map((resource) => ({
        file: new URL(resource.name).pathname,
        transfer: resource.transferSize ?? 0,
        decoded: resource.decodedBodySize ?? 0,
        duration: Math.round(resource.duration ?? 0),
      }));
    return {
      fcp: state.fcp ?? null,
      lcp: state.lcp ?? null,
      lcpElement: state.lcpElement ?? null,
      cls: state.cls ?? 0,
      longTaskCount: longTasks.length,
      tbt: longTasks.reduce((sum, task) => sum + Math.max(0, task.duration - 50), 0),
      longTaskTime: longTasks.reduce((sum, task) => sum + task.duration, 0),
      longTasks: longTasks.slice(0, 12),
      nav: nav
        ? {
            ttfb: nav.responseStart,
            domContentLoaded: nav.domContentLoadedEventEnd,
            load: nav.loadEventEnd,
            responseEnd: nav.responseEnd,
          }
        : null,
      resources: groups,
      jsFiles,
      requests: resources.length + 1,
      totalTransfer: resources.reduce((sum, r) => sum + (r.transferSize ?? 0), 0),
      totalDecoded: resources.reduce((sum, r) => sum + (r.decodedBodySize ?? 0), 0),
    };
  });

const browser = await chromium.launch();
const results = [];

const warmup = args.get("warmup") === "1";
if (warmup) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  try {
    await page.goto(baseUrl, { waitUntil: "load", timeout: 180000 });
    await page.waitForTimeout(1500);
  } catch {
    // Warm-up failures are reported by the measured runs.
  }
  await context.close();
}

for (const profileName of profiles) {
  const profile = PROFILES[profileName];
  if (!profile) continue;

  for (let run = 1; run <= runs; run += 1) {
    const context = await browser.newContext({
      viewport: profile.viewport,
      deviceScaleFactor: profile.deviceScaleFactor,
      isMobile: profile.isMobile,
      hasTouch: profile.hasTouch,
      locale: "en-US",
      javaScriptEnabled: args.get("no-js") !== "1",
    });
    await context.addInitScript(INIT_SCRIPT);
    if (args.get("tauri-stub") === "1") {
      await context.addInitScript(() => {
        window.__TAURI_INTERNALS__ = {
          invoke: async (command) => {
            const name = String(command).toLowerCase();
            if (name.includes("runtime_config")) return {};
            if (name.includes("list") || name.includes("artifacts")) return [];
            if (name.includes("state") || name.includes("status")) return {};
            if (name.includes("is_") || name.includes("enabled")) return false;
            if (name.includes("get_") || name.includes("info")) return {};
            return null;
          },
          transformCallback: (callback) => {
            const id = Math.floor(Math.random() * 1_000_000_000);
            window[`_${id}`] = callback;
            return id;
          },
          unregisterCallback: () => {},
          convertFileSrc: (value) => value,
          metadata: {
            currentWindow: { label: "main" },
            currentWebview: { label: "main" },
          },
          plugins: {},
        };
      });
    }
    const page = await context.newPage();
    const block = args.get("block");
    if (block) {
      await context.route("**/*", (route) =>
        route.request().url().includes(block) ? route.abort() : route.continue(),
      );
    }
    const client = await context.newCDPSession(page);
    await client.send("Network.enable");
    await client.send("Performance.enable");
    await client.send("Network.clearBrowserCache");
    await client.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: profile.network.latency,
      downloadThroughput: profile.network.download,
      uploadThroughput: profile.network.upload,
      connectionType: "cellular3g",
    });
    await client.send("Emulation.setCPUThrottlingRate", { rate: profile.cpu });

    const started = Date.now();
    let navigationError = null;
    try {
      await page.goto(baseUrl, { waitUntil: "load", timeout: 180000 });
      if (waitForText) {
        await page.waitForFunction(
          (needle) => document.body.innerText.toLowerCase().includes(needle.toLowerCase()),
          waitForText,
          { timeout: 120000, polling: 100 },
        );
      } else {
        await page.waitForFunction(() => document.body.innerText.trim().length > 40, {
          timeout: 120000,
          polling: 100,
        });
      }
      await page.waitForTimeout(2500);
    } catch (error) {
      navigationError = String(error).slice(0, 400);
    }

    const metrics = await collect(page);
    let performanceMetrics = null;
    try {
      const { metrics: rawMetrics } = await client.send("Performance.getMetrics");
      performanceMetrics = Object.fromEntries(
        rawMetrics
          .filter((metric) =>
            [
              "ScriptDuration",
              "LayoutDuration",
              "RecalcStyleDuration",
              "TaskDuration",
              "JSHeapUsedSize",
              "Nodes",
              "Documents",
            ].includes(metric.name),
          )
          .map((metric) => [metric.name, metric.value]),
      );
    } catch {
      performanceMetrics = null;
    }
    const wallTime = Date.now() - started;
    const result = {
      profile: profileName,
      run,
      url: baseUrl,
      wallTime,
      error: navigationError,
      performanceMetrics,
      ...metrics,
    };
    results.push(result);

    const kb = (value) => `${(value / 1024).toFixed(1)}kB`;
    console.log(
      [
        `${profileName} run ${run}`,
        `FCP ${Math.round(metrics.fcp ?? -1)}ms`,
        `LCP ${Math.round(metrics.lcp ?? -1)}ms`,
        `TTFB ${Math.round(metrics.nav?.ttfb ?? -1)}ms`,
        `load ${Math.round(metrics.nav?.load ?? -1)}ms`,
        `TBT ${Math.round(metrics.tbt)}ms (${metrics.longTaskCount} tasks)`,
        `transfer ${kb(metrics.totalTransfer)}`,
        `requests ${metrics.requests}`,
        `wall ${wallTime}ms`,
        navigationError ? `ERROR ${navigationError}` : "",
      ]
        .filter(Boolean)
        .join(" | "),
    );
    console.log(
      "  resources:",
      Object.entries(metrics.resources)
        .map(([key, value]) => `${key} ${value.count}/${kb(value.transfer)}`)
        .join(" "),
    );

    await context.close();
  }
}

await browser.close();
server.close();

mkdirSync(outDir, { recursive: true });
const outputFile = path.join(outDir, `${label}-${Date.now()}.json`);
writeFileSync(
  outputFile,
  JSON.stringify({ label, root, route, profiles, runs, results }, null, 2),
);
console.log(`results written to ${outputFile}`);
