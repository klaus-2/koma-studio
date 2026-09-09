#!/usr/bin/env node
/**
 * Phase 1.6.4 performance benchmark for the Electron v1 shell vs Tauri v2 shell.
 *
 * Windows is the release gate for Phase 1. The benchmark measures real desktop
 * processes where possible: cold start to first window, idle RAM, startup-load
 * peak RAM, and release payload sizes.
 */

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(rootDir, "..");
const v1Root = process.env.KOMA_V1_ROOT
  ? path.resolve(process.env.KOMA_V1_ROOT)
  : path.join(workspaceRoot, "koma-studio");

const MB = 1024 * 1024;
const DEFAULT_READY_TIMEOUT_MS = 20_000;
const DEFAULT_IDLE_MS = 5_000;
const DEFAULT_LOAD_MS = 10_000;
const DEFAULT_POLL_MS = 500;

const parseArgs = () => {
  const options = {
    readyTimeoutMs: DEFAULT_READY_TIMEOUT_MS,
    idleMs: DEFAULT_IDLE_MS,
    loadMs: DEFAULT_LOAD_MS,
    pollMs: DEFAULT_POLL_MS,
    reportPath: path.join(rootDir, "docs", "V2-PERFORMANCE-BENCHMARK.md"),
    jsonPath: path.join(rootDir, "docs", "V2-PERFORMANCE-BENCHMARK.json"),
  };

  for (let i = 2; i < process.argv.length; i += 1) {
    const arg = process.argv[i];
    const readValue = () => {
      const value = process.argv[i + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${arg} requires a value`);
      }
      i += 1;
      return value;
    };

    if (arg === "--v1-exe") options.v1Exe = path.resolve(readValue());
    else if (arg === "--v2-exe") options.v2Exe = path.resolve(readValue());
    else if (arg === "--v1-install-dir") options.v1InstallDir = path.resolve(readValue());
    else if (arg === "--v2-install-dir") options.v2InstallDir = path.resolve(readValue());
    else if (arg === "--report") options.reportPath = path.resolve(readValue());
    else if (arg === "--json") options.jsonPath = path.resolve(readValue());
    else if (arg === "--ready-timeout-ms") options.readyTimeoutMs = Number(readValue());
    else if (arg === "--idle-ms") options.idleMs = Number(readValue());
    else if (arg === "--load-ms") options.loadMs = Number(readValue());
    else if (arg === "--poll-ms") options.pollMs = Number(readValue());
    else if (arg === "--sizes-only") options.sizesOnly = true;
    else if (arg === "--allow-fail") options.allowFail = true;
    else if (arg === "--help") options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
};

const printHelp = () => {
  console.log(`Usage: node scripts/benchmark-phase1-performance.mjs [options]

Options:
  --v1-exe <path>             Electron v1 executable.
  --v2-exe <path>             Tauri v2 executable.
  --v1-install-dir <path>     v1 unpacked install directory.
  --v2-install-dir <path>     v2 unpacked install directory.
  --report <path>             Markdown report path.
  --json <path>               JSON report path.
  --sizes-only                Skip process launch metrics.
  --allow-fail                Write reports but exit 0 even when thresholds fail.
  --ready-timeout-ms <n>      Timeout waiting for first window. Default ${DEFAULT_READY_TIMEOUT_MS}.
  --idle-ms <n>               Delay after first window before idle sample. Default ${DEFAULT_IDLE_MS}.
  --load-ms <n>               Peak-memory sampling window after idle. Default ${DEFAULT_LOAD_MS}.
  --poll-ms <n>               Poll interval. Default ${DEFAULT_POLL_MS}.
`);
};

const runPowerShellJson = (script) => {
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
    { encoding: "utf8", windowsHide: true },
  );

  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "PowerShell command failed").trim());
  }

  const output = result.stdout.trim();
  if (!output) return null;
  return JSON.parse(output);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const exists = (candidate) => Boolean(candidate && fs.existsSync(candidate));

const newestPath = (paths) =>
  paths
    .filter(exists)
    .map((candidate) => ({ candidate, mtime: fs.statSync(candidate).mtimeMs }))
    .sort((left, right) => right.mtime - left.mtime)[0]?.candidate ?? null;

const listDirs = (dir) => {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(dir, entry.name));
};

const walkFiles = (target) => {
  if (!fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];
  if (!stat.isDirectory()) return [];

  const stack = [target];
  const files = [];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(fullPath);
      else if (entry.isFile()) files.push(fullPath);
    }
  }
  return files;
};

// oxlint-disable-next-line no-control-regex -- intentional ASCII folding: drops every non-ASCII character
const foldAscii = (value) => String(value).normalize("NFKD").replace(/[^\x00-\x7F]/g, "");

const sizeOfTargets = (targets) => {
  const seen = new Set();
  let bytes = 0;
  const files = [];

  for (const target of targets.filter(Boolean)) {
    for (const file of walkFiles(target)) {
      const resolved = path.resolve(file);
      if (seen.has(resolved)) continue;
      seen.add(resolved);
      const size = fs.statSync(resolved).size;
      bytes += size;
      files.push({ path: resolved, bytes: size });
    }
  }

  return { bytes, files: files.length };
};

const findLatestReleaseDir = (root) =>
  newestPath(listDirs(path.join(root, "release-desktop")).filter((dir) => path.basename(dir).startsWith("hardened-")));

const findV1Executable = () => {
  const releaseDir = findLatestReleaseDir(v1Root);
  const winUnpacked = releaseDir ? path.join(releaseDir, "win-unpacked") : null;
  const exactReleaseExe = winUnpacked ? path.join(winUnpacked, "KOMA Studio.exe") : null;
  if (exists(exactReleaseExe)) return exactReleaseExe;

  if (exists(winUnpacked)) {
    const releaseExe = fs
      .readdirSync(winUnpacked, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".exe"))
      .map((entry) => path.join(winUnpacked, entry.name))
      .find((file) => /(?:koma|studio)/i.test(foldAscii(path.basename(file))));
    if (releaseExe) return releaseExe;
  }

  const electronExe = path.join(v1Root, "node_modules", "electron", "dist", "electron.exe");
  return exists(electronExe) ? electronExe : null;
};

const findV2Executable = () => {
  const candidates = [];
  if (process.env.CARGO_TARGET_DIR) {
    candidates.push(path.join(process.env.CARGO_TARGET_DIR, "release", "koma-studio-v2.exe"));
    candidates.push(path.join(process.env.CARGO_TARGET_DIR, "release", "KOMA Studio.exe"));
  }

  candidates.push(path.join(rootDir, "src-tauri", "target", "release", "koma-studio-v2.exe"));
  candidates.push(path.join(rootDir, "src-tauri", "target", "release", "KOMA Studio.exe"));

  const releaseDir = path.join(rootDir, "src-tauri", "target", "release");
  if (fs.existsSync(releaseDir)) {
    for (const file of walkFiles(releaseDir)) {
      if (/\\.(exe)$/i.test(file) && /(?:koma|studio)/i.test(path.basename(file))) {
        candidates.push(file);
      }
    }
  }

  return newestPath(candidates);
};

const findLatestByExtension = (root, extensions) => {
  if (!fs.existsSync(root)) return null;
  const matches = walkFiles(root).filter((file) => extensions.has(path.extname(file).toLowerCase()));
  return newestPath(matches);
};

const findLatestTopLevelByExtension = (root, extensions) => {
  if (!fs.existsSync(root)) return null;
  const matches = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => path.join(root, entry.name));
  return newestPath(matches);
};

const resolveV2BundleDirs = () => {
  const dirs = [];
  const addBundleDir = (releaseDir) => {
    if (!releaseDir) return;
    dirs.push(path.join(releaseDir, "bundle"));
  };

  if (process.env.CARGO_TARGET_DIR) {
    addBundleDir(path.join(process.env.CARGO_TARGET_DIR, "release"));
  }

  addBundleDir(path.join(rootDir, "src-tauri", "target", "release"));

  return [...new Set(dirs.map((dir) => path.resolve(dir)))].filter((dir) => fs.existsSync(dir));
};

const resolveInstallDir = (exePath, override) => {
  if (override) return override;
  if (!exePath) return null;
  const dir = path.dirname(exePath);
  if (path.basename(dir).toLowerCase() === "win-unpacked") return dir;
  return null;
};

const getProcessMetrics = (pid) => {
  const script = `
$rootPid = ${Number(pid)}
$known = [System.Collections.Generic.HashSet[int]]::new()
[void]$known.Add($rootPid)
for ($pass = 0; $pass -lt 8; $pass++) {
  $children = @(Get-CimInstance Win32_Process | Where-Object {
    $known.Contains([int]$_.ParentProcessId) -and -not $known.Contains([int]$_.ProcessId)
  })
  if ($children.Count -eq 0) { break }
  foreach ($child in $children) { [void]$known.Add([int]$child.ProcessId) }
}
$ids = @($known)
$processes = @(Get-Process | Where-Object { $ids -contains $_.Id })
$rootProcess = @($processes | Where-Object { $_.Id -eq $rootPid } | Select-Object -First 1)
$rootAlive = @($processes | Where-Object { $_.Id -eq $rootPid }).Count -gt 0
$windowReady = @($processes | Where-Object { $_.MainWindowHandle -ne 0 }).Count -gt 0
$payload = [pscustomobject]@{
  alive = [bool]($rootAlive -or $processes.Count -gt 0)
  ids = $ids
  count = $processes.Count
  workingSetBytes = [int64](($processes | Measure-Object WorkingSet64 -Sum).Sum)
  privateBytes = [int64](($processes | Measure-Object PrivateMemorySize64 -Sum).Sum)
  windowReady = [bool]$windowReady
  rootProcess = if ($rootProcess) { $rootProcess | Select-Object Id, ProcessName, WorkingSet64, PrivateMemorySize64, MainWindowHandle, MainWindowTitle } else { $null }
  processes = @($processes | Select-Object Id, ProcessName, WorkingSet64, PrivateMemorySize64, MainWindowHandle, MainWindowTitle)
}
$payload | ConvertTo-Json -Depth 5 -Compress
`;
  return runPowerShellJson(script);
};

const killProcessTree = (pid) => {
  if (!pid) return;
  spawnSync("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
    encoding: "utf8",
    windowsHide: true,
  });
};

const launchAndMeasure = async (app, options) => {
  if (!app.exe) {
    return { status: "missing", error: "Executable not found" };
  }

  const startedAt = performance.now();
  const child = spawn(app.exe, app.args ?? [], {
    cwd: app.cwd ?? path.dirname(app.exe),
    detached: false,
    env: { ...process.env, KOMA_PHASE1_BENCHMARK: "1" },
    stdio: "ignore",
    windowsHide: false,
  });

  let coldStartMs = null;
  let readyMetrics = null;
  let spawnError = null;
  child.once("error", (error) => {
    spawnError = error;
  });

  try {
    while (performance.now() - startedAt < options.readyTimeoutMs) {
      if (spawnError) throw spawnError;
      const metrics = getProcessMetrics(child.pid);
      if (!metrics?.alive) {
        throw new Error("Process exited before creating a window");
      }
      if (metrics.windowReady) {
        coldStartMs = Math.round(performance.now() - startedAt);
        readyMetrics = metrics;
        break;
      }
      await sleep(options.pollMs);
    }

    if (coldStartMs === null) {
      throw new Error(`No main window after ${options.readyTimeoutMs}ms`);
    }

    await sleep(options.idleMs);
    const idleMetrics = getProcessMetrics(child.pid);
    if (!idleMetrics?.alive) {
      throw new Error("Process exited before idle memory sample");
    }

    const loadStartedAt = performance.now();
    let loadPeakMetrics = idleMetrics;
    while (performance.now() - loadStartedAt < options.loadMs) {
      const current = getProcessMetrics(child.pid);
      if (!current?.alive) break;
      if (current.workingSetBytes > loadPeakMetrics.workingSetBytes) {
        loadPeakMetrics = current;
      }
      await sleep(options.pollMs);
    }

    return {
      status: "measured",
      pid: child.pid,
      coldStartMs,
      readyProcessCount: readyMetrics.count,
      idle: summarizeMetrics(idleMetrics),
      loadPeak: summarizeMetrics(loadPeakMetrics),
    };
  } catch (error) {
    return {
      status: "failed",
      pid: child.pid,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    killProcessTree(child.pid);
    child.unref();
  }
};

const summarizeProcess = (proc) =>
  proc
    ? {
        pid: proc.Id,
        name: proc.ProcessName,
        workingSetBytes: proc.WorkingSet64,
        privateBytes: proc.PrivateMemorySize64,
        windowTitle: proc.MainWindowTitle,
      }
    : null;

const summarizeMetrics = (metrics) => ({
  processCount: metrics.count,
  workingSetBytes: metrics.workingSetBytes,
  privateBytes: metrics.privateBytes,
  rootProcess: summarizeProcess(metrics.rootProcess),
  topProcesses: [...(metrics.processes ?? [])]
    .sort((left, right) => right.WorkingSet64 - left.WorkingSet64)
    .slice(0, 8)
    .map(summarizeProcess),
});

const metricMb = (bytes) => Number((bytes / MB).toFixed(2));

const makeThreshold = (label, actual, limit, comparator = (value, max) => value <= max) => ({
  label,
  actual,
  limit,
  pass: typeof actual === "number" && comparator(actual, limit),
});

const buildSizeReport = ({ v1Exe, v2Exe, v1InstallDir, v2InstallDir }) => {
  const v1ReleaseDir = findLatestReleaseDir(v1Root);
  const v2BundleDirs = resolveV2BundleDirs();

  const v1FullInstaller = v1ReleaseDir
    ? newestPath([
        findLatestTopLevelByExtension(v1ReleaseDir, new Set([".zip"])),
        findLatestTopLevelByExtension(v1ReleaseDir, new Set([".exe"])),
        findLatestTopLevelByExtension(v1ReleaseDir, new Set([".msi"])),
      ])
    : null;
  const v1Installer =
    v1FullInstaller ??
    (v1ReleaseDir ? findLatestTopLevelByExtension(path.join(v1ReleaseDir, "nsis-web"), new Set([".exe"])) : null);

  const v2Msi = newestPath(v2BundleDirs.map((dir) => findLatestByExtension(dir, new Set([".msi"]))));
  const v2Installer =
    v2Msi ?? newestPath(v2BundleDirs.map((dir) => findLatestByExtension(dir, new Set([".exe"]))));

  const v1Unpacked = sizeOfTargets([v1InstallDir]);
  const v2RuntimeTargets = [v2InstallDir, v2Exe, path.join(rootDir, "src-tauri", "bin")].filter(Boolean);
  const v2Runtime = sizeOfTargets(v2RuntimeTargets);

  return {
    v1: {
      exe: v1Exe,
      installDir: v1InstallDir,
      installer: v1Installer,
      unpackedBytes: v1Unpacked.bytes,
      unpackedFiles: v1Unpacked.files,
      installerBytes: v1Installer ? fs.statSync(v1Installer).size : null,
    },
    v2: {
      exe: v2Exe,
      installDir: v2InstallDir,
      installer: v2Installer,
      runtimeTargets: v2RuntimeTargets,
      unpackedBytes: v2Runtime.bytes,
      unpackedFiles: v2Runtime.files,
      installerBytes: v2Installer ? fs.statSync(v2Installer).size : null,
    },
  };
};

const compare = (v1, v2, _field) => {
  if (typeof v1 !== "number" || typeof v2 !== "number") return null;
  return {
    delta: Number((v2 - v1).toFixed(2)),
    reductionPercent: Number((((v1 - v2) / v1) * 100).toFixed(2)),
  };
};

const buildSummary = ({ launch, sizes, options }) => {
  const v1Launch = launch.v1;
  const v2Launch = launch.v2;

  const v1ColdStart = v1Launch.status === "measured" ? v1Launch.coldStartMs : null;
  const v2ColdStart = v2Launch.status === "measured" ? v2Launch.coldStartMs : null;
  const v1IdleMb =
    v1Launch.status === "measured" && typeof v1Launch.idle.rootProcess?.workingSetBytes === "number"
      ? metricMb(v1Launch.idle.rootProcess.workingSetBytes)
      : null;
  const v2IdleMb =
    v2Launch.status === "measured" && typeof v2Launch.idle.rootProcess?.workingSetBytes === "number"
      ? metricMb(v2Launch.idle.rootProcess.workingSetBytes)
      : null;
  const v1IdleTreeMb = v1Launch.status === "measured" ? metricMb(v1Launch.idle.workingSetBytes) : null;
  const v2IdleTreeMb = v2Launch.status === "measured" ? metricMb(v2Launch.idle.workingSetBytes) : null;
  const v1LoadMb = v1Launch.status === "measured" ? metricMb(v1Launch.loadPeak.workingSetBytes) : null;
  const v2LoadMb = v2Launch.status === "measured" ? metricMb(v2Launch.loadPeak.workingSetBytes) : null;
  const v1InstallerMb = typeof sizes.v1.installerBytes === "number" ? metricMb(sizes.v1.installerBytes) : null;
  const v2InstallerMb = typeof sizes.v2.installerBytes === "number" ? metricMb(sizes.v2.installerBytes) : null;
  const v2UnpackedMb = metricMb(sizes.v2.unpackedBytes);

  const thresholds = [
    makeThreshold("v2 cold start <= 2s", v2ColdStart, 2_000),
    makeThreshold("v2 app RAM idle <= 80MB", v2IdleMb, 80),
    makeThreshold("v2 installer <= 20MB", v2InstallerMb, 20),
    makeThreshold("v2 runtime payload <= 20MB", v2UnpackedMb, 20),
  ];

  if (!options.sizesOnly) {
    thresholds.push({
      label: "v1 launch measured",
      actual: v1Launch.status,
      limit: "measured",
      pass: v1Launch.status === "measured",
    });
    thresholds.push({
      label: "v2 launch measured",
      actual: v2Launch.status,
      limit: "measured",
      pass: v2Launch.status === "measured",
    });
  }

  return {
    metrics: {
      coldStartMs: { v1: v1ColdStart, v2: v2ColdStart, comparison: compare(v1ColdStart, v2ColdStart) },
      ramIdleMb: { v1: v1IdleMb, v2: v2IdleMb, comparison: compare(v1IdleMb, v2IdleMb) },
      ramIdleProcessTreeMb: { v1: v1IdleTreeMb, v2: v2IdleTreeMb, comparison: compare(v1IdleTreeMb, v2IdleTreeMb) },
      ramUnderStartupLoadMb: { v1: v1LoadMb, v2: v2LoadMb, comparison: compare(v1LoadMb, v2LoadMb) },
      installerMb: { v1: v1InstallerMb, v2: v2InstallerMb, comparison: compare(v1InstallerMb, v2InstallerMb) },
      unpackedPayloadMb: {
        v1: metricMb(sizes.v1.unpackedBytes),
        v2: v2UnpackedMb,
        comparison: compare(metricMb(sizes.v1.unpackedBytes), v2UnpackedMb),
      },
    },
    thresholds,
    pass: thresholds.every((threshold) => threshold.pass),
  };
};

const mdValue = (value, suffix = "") => {
  if (value === null || value === undefined) return "n/a";
  return `${value}${suffix}`;
};

const renderMarkdown = (report) => {
  const { summary, launch, sizes, options } = report;
  const rows = [
    ["Cold start to first window", mdValue(summary.metrics.coldStartMs.v1, " ms"), mdValue(summary.metrics.coldStartMs.v2, " ms")],
    ["RAM idle app process", mdValue(summary.metrics.ramIdleMb.v1, " MB"), mdValue(summary.metrics.ramIdleMb.v2, " MB")],
    [
      "RAM idle process tree",
      mdValue(summary.metrics.ramIdleProcessTreeMb.v1, " MB"),
      mdValue(summary.metrics.ramIdleProcessTreeMb.v2, " MB"),
    ],
    [
      "RAM under startup load peak (process tree)",
      mdValue(summary.metrics.ramUnderStartupLoadMb.v1, " MB"),
      mdValue(summary.metrics.ramUnderStartupLoadMb.v2, " MB"),
    ],
    ["Installer artifact", mdValue(summary.metrics.installerMb.v1, " MB"), mdValue(summary.metrics.installerMb.v2, " MB")],
    ["Runtime/unpacked payload", mdValue(summary.metrics.unpackedPayloadMb.v1, " MB"), mdValue(summary.metrics.unpackedPayloadMb.v2, " MB")],
  ];

  const thresholdRows = summary.thresholds.map((threshold) => [
    threshold.label,
    String(threshold.actual ?? "n/a"),
    String(threshold.limit),
    threshold.pass ? "PASS" : "FAIL",
  ]);

  const details = [
    ["v1 executable", sizes.v1.exe ?? "missing"],
    ["v2 executable", sizes.v2.exe ?? "missing"],
    ["v1 install dir", sizes.v1.installDir ?? "missing"],
    ["v2 runtime targets", sizes.v2.runtimeTargets.length > 0 ? sizes.v2.runtimeTargets.join("; ") : "missing"],
    ["v1 installer", sizes.v1.installer ?? "missing"],
    ["v2 installer", sizes.v2.installer ?? "missing"],
  ];

  return `# V2 Phase 1 Performance Benchmark

Generated: ${report.generatedAt}
Host: ${os.hostname()} (${os.platform()} ${os.release()}, ${os.arch()})

## Method

- Cold start is measured from process spawn to the first non-zero Windows main window handle.
- RAM idle app process is the root desktop process working set after ${options.idleMs}ms of post-window settle time; this is the Phase 1 <=80MB gate.
- RAM idle process tree keeps the full renderer/WebView2 tree visible as diagnostic telemetry, not as the <=80MB shell gate.
- RAM under load is the peak process-tree working set sampled for ${options.loadMs}ms after the idle sample. This is a startup-load proxy, not a full AIO pipeline workload.
- Installer size uses the newest release installer artifact found for each version.
- Runtime/unpacked payload uses v1 \`win-unpacked\`; for v2 it uses the Tauri executable plus staged sidecar/runtime targets.

## Results

| Metric | v1 Electron | v2 Tauri |
| --- | ---: | ---: |
${rows.map((row) => `| ${row[0]} | ${row[1]} | ${row[2]} |`).join("\n")}

## Thresholds

| Gate | Actual | Limit | Result |
| --- | ---: | ---: | --- |
${thresholdRows.map((row) => `| ${row[0]} | ${row[1]} | ${row[2]} | ${row[3]} |`).join("\n")}

Overall: **${summary.pass ? "PASS" : "FAIL"}**

## Artifacts

| Artifact | Path |
| --- | --- |
${details.map((row) => `| ${row[0]} | \`${row[1]}\` |`).join("\n")}

## Launch Status

| App | Status | Details |
| --- | --- | --- |
| v1 Electron | ${launch.v1.status} | ${launch.v1.error ?? `${launch.v1.readyProcessCount} ready processes`} |
| v2 Tauri | ${launch.v2.status} | ${launch.v2.error ?? `${launch.v2.readyProcessCount} ready processes`} |
`;
};

const main = async () => {
  const options = parseArgs();
  if (options.help) {
    printHelp();
    return;
  }

  if (process.platform !== "win32" && !options.sizesOnly) {
    throw new Error("Process launch metrics are Windows-only. Use --sizes-only on non-Windows hosts.");
  }

  const v1Exe = options.v1Exe ?? findV1Executable();
  const v2Exe = options.v2Exe ?? findV2Executable();
  const v1InstallDir = resolveInstallDir(v1Exe, options.v1InstallDir);
  const v2InstallDir = resolveInstallDir(v2Exe, options.v2InstallDir);

  const sizes = buildSizeReport({ v1Exe, v2Exe, v1InstallDir, v2InstallDir });
  const launch = options.sizesOnly
    ? { v1: { status: "skipped" }, v2: { status: "skipped" } }
    : {
        v1: await launchAndMeasure(
          {
            exe: v1Exe,
            args: v1Exe?.endsWith(path.join("electron", "dist", "electron.exe")) ? [v1Root] : [],
            cwd: v1Root,
          },
          options,
        ),
        v2: await launchAndMeasure({ exe: v2Exe, cwd: rootDir }, options),
      };

  const report = {
    generatedAt: new Date().toISOString(),
    options,
    sizes,
    launch,
    summary: null,
  };
  report.summary = buildSummary({ launch, sizes, options });

  fs.mkdirSync(path.dirname(options.jsonPath), { recursive: true });
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(options.reportPath, renderMarkdown(report));

  console.log(`Wrote ${path.relative(rootDir, options.jsonPath)}`);
  console.log(`Wrote ${path.relative(rootDir, options.reportPath)}`);
  for (const threshold of report.summary.thresholds) {
    console.log(`${threshold.pass ? "PASS" : "FAIL"} ${threshold.label}: ${threshold.actual} (limit ${threshold.limit})`);
  }

  if (!report.summary.pass && !options.allowFail) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
