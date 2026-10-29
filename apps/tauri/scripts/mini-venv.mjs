#!/usr/bin/env node
/**
 * Cross-platform bootstrap for the mini-backend Python virtualenv.
 *
 * Usage:
 *   node scripts/mini-venv.mjs                # create .venv-mini if missing
 *   node scripts/mini-venv.mjs --install      # also install requirements + hardening deps
 *   node scripts/mini-venv.mjs --ensure       # no-op when already provisioned (auto-bootstrap)
 *   node scripts/mini-venv.mjs --check        # exit 0 = ready, 1 = needs provisioning,
 *                                             # 4 = provably unusable (what tauri:dev blocks on)
 *   node scripts/mini-venv.mjs --recreate     # rebuild the venv from scratch (the repair for
 *                                             # a half-installed venv, which a reinstall cannot fix)
 *   node scripts/mini-venv.mjs --install --profile nvidia-cuda
 *
 * Hardware profiles: `--profile <id>` (or $KOMA_BUILD_PROFILE) selects which
 * `mini-backend/requirements*.txt` is installed. Every profile file starts with
 * `-r requirements.txt`, so a profile install is the base set plus that
 * profile's native wheels — never a separate dependency tree. Omitting the flag
 * installs the CPU set, which is what `tauri:dev` wants.
 *
 * Caching: after a successful install the SHA-256 of the *resolved* requirements
 * file is written to `.venv-mini/.koma-install-stamp.json` along with the
 * profile id. `--ensure` re-installs only when that fingerprint or the profile
 * changes (or the venv is gone), so repeated `bun run tauri:dev` invocations
 * cost a single file hash instead of a multi-GB pip run — while a build that
 * switches from CPU to CUDA correctly forces the extra wheels in.
 *
 * The Python interpreter can be overridden with MINI_BACKEND_PYTHON; otherwise
 * the first working candidate for the target version is used.
 */

import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_PROFILE,
  normalizeProfile,
  platformKeyFromNodePlatform,
  resolveProfileRequirements,
} from "./lib/hardware-profiles.mjs";
import {
  CUDA_PROVIDER_PROBE_SNIPPET,
  TORCH_CUDA_INDEX_URL,
  conflictingOnnxruntimeVariant,
  onnxruntimeVariantOf,
  requiresNvidiaProviderProbe,
  resolveOnnxruntimeRequirement,
  withoutTorchLines,
} from "./lib/mini-venv-gpu.mjs";
import {
  ACCELERATION_PROFILE_KEY,
  readEnvFileValue,
  resolveActiveProfile,
} from "./lib/mini-dev-env.mjs";
import {
  EXIT_UNUSABLE,
  classifyTauriVerdict,
  runImportQuery,
  runRecreateOnce,
} from "./lib/mini-venv-verdict.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const venvDir = path.join(rootDir, ".venv-mini");
const isWindows = process.platform === "win32";
const venvPython = isWindows
  ? path.join(venvDir, "Scripts", "python.exe")
  : path.join(venvDir, "bin", "python");
const stampPath = path.join(venvDir, ".koma-install-stamp.json");
// Presence of this file means "a pip install is running right now". `python -m
// venv` creates a usable interpreter in seconds, but the dependencies take
// minutes-to-hours, so between those two moments the venv looks complete while
// importing anything from requirements.txt still fails. The desktop app reads
// this lock to wait instead of spawning a sidecar that is doomed to crash.
const provisioningLockPath = path.join(venvDir, ".koma-provisioning.json");

const QUERY_MODULES = ["fastapi", "onnxruntime", "torch", "cv2"];
// A `cv2` directory that lost its `__init__.py` still imports as a namespace
// package and only fails at the first attribute read — which happens at import
// time in routers/enhance.py (IMWRITE_WEBP_QUALITY), so the sidecar dies on
// boot. That state comes from two opencv distributions (opencv-python and
// opencv-python-headless) overwriting each other's files, so the query asserts
// a native symbol instead of trusting that the import succeeded.
const QUERY_PROBE =
  "if not hasattr(cv2, 'imencode'):\n    raise SystemExit('cv2 has no native module: conflicting opencv distributions?')";
const QUERY_TIMEOUT_MS = 120_000;

const withInstall = process.argv.includes("--install");
const withEnsure = process.argv.includes("--ensure");
const withCheck = process.argv.includes("--check");
const withRecreate = process.argv.includes("--recreate");

/**
 * Read `--profile <id>`. The value may also arrive as $KOMA_BUILD_PROFILE,
 * which is how `build-hardened-release.mjs` forwards the operator's answer to
 * the interactive prompt without rewriting the `bun run mini:install-deps`
 * command line.
 */
const readProfileArg = () => {
  const index = process.argv.indexOf("--profile");
  if (index >= 0) return process.argv[index + 1] ?? null;
  return null;
};

const activeProfile = resolveActiveProfile({
  argvProfile: readProfileArg(),
  envProfile: process.env.KOMA_BUILD_PROFILE ?? null,
  fileValue: readEnvFileValue(rootDir, ACCELERATION_PROFILE_KEY),
});
const platformKey = platformKeyFromNodePlatform(process.platform);

let resolvedRequirements;
try {
  resolvedRequirements = resolveProfileRequirements(activeProfile, platformKey);
} catch (error) {
  console.error(`✗ ${error.message}`);
  process.exit(1);
}

const requirementsPath = path.join(rootDir, "..", "..", "packages", "mini-backend", resolvedRequirements.relativePath);

// onnxruntime and onnxruntime-gpu share one package namespace, so a venv can
// import a CPU-only runtime while its GPU dist-info still looks installed —
// the exact state that silently strips the CUDA provider from a CUDA-profile
// venv. NVIDIA profiles therefore assert the provider, not just the import.
const queryProbe = requiresNvidiaProviderProbe(activeProfile)
  ? `${QUERY_PROBE}${CUDA_PROVIDER_PROBE_SNIPPET}`
  : QUERY_PROBE;

/** Maintainer-published index of prebuilt CPU wheels for llama-cpp-python. */
const LLAMA_WHEEL_INDEX = "https://abetlen.github.io/llama-cpp-python/whl/cpu";

/**
 * Expand a requirements file into its own lines plus those of every file it
 * pulls in with `-r` / `--requirement`, depth-first.
 *
 * Profile files are thin: `requirements-windows-nvidia.txt` is `-r
 * requirements.txt` followed by the CUDA wheels. Anything that needs to find a
 * pin — the llama lookup below, the fingerprint above — therefore has to read
 * through the include or it will silently miss the base set. `seen` guards
 * against a cyclic include hanging the build.
 */
const readRequirementLines = (filePath, seen = new Set()) => {
  const absolute = path.resolve(filePath);
  if (seen.has(absolute)) return [];
  seen.add(absolute);

  let raw;
  try {
    raw = fs.readFileSync(absolute, "utf8");
  } catch {
    // Unreadable requirements are reported by computeRequirementsHash().
    return [];
  }

  const lines = [];
  for (const line of raw.split(/\r?\n/)) {
    const entry = line.split("#")[0].trim();
    if (entry === "") continue;
    const include = /^(?:-r|--requirement(?:=|\s+))\s*(.+)$/.exec(entry);
    if (include) {
      lines.push(...readRequirementLines(path.join(path.dirname(absolute), include[1].trim()), seen));
      continue;
    }
    lines.push(entry);
  }
  return lines;
};

/**
 * Read the llama-cpp-python line out of the already-expanded requirements so
 * the wheel pass installs exactly the pinned range. Returning the requirement
 * verbatim keeps the requirements files the single source of truth: bump the
 * pin there and this follows.
 */
const readLlamaRequirement = (lines) =>
  lines.find((entry) => /^llama[-_]cpp[-_]python\b/i.test(entry)) ?? null;

/**
 * Fingerprint of the inputs that decide whether a reinstall is needed.
 *
 * Hashes the *expanded* requirement list rather than the raw bytes of the
 * profile file, so editing `requirements.txt` invalidates every profile venv
 * that includes it — hashing `requirements-linux-nvidia.txt` alone would leave
 * a stale venv looking up to date after a base-set bump. Expansion also
 * normalizes comments and blank lines out of the hash, so a comment-only edit
 * no longer triggers a multi-GB reinstall.
 */
const computeRequirementsHash = () => {
  const lines = readRequirementLines(requirementsPath);
  if (lines.length === 0) return null;
  return crypto.createHash("sha256").update(lines.join("\n")).digest("hex");
};

const readStamp = () => {
  try {
    return JSON.parse(fs.readFileSync(stampPath, "utf8"));
  } catch {
    return null;
  }
};

/**
 * Mark the venv as "install in progress" so concurrent readers (notably the
 * Rust sidecar launcher, which now runs in parallel with this script) can tell
 * a half-provisioned venv from a finished one.
 */
const writeProvisioningLock = () => {
  try {
    fs.mkdirSync(venvDir, { recursive: true });
    fs.writeFileSync(
      provisioningLockPath,
      `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }, null, 2)}\n`,
      "utf8",
    );
  } catch (error) {
    console.warn(`▸ warning: could not write provisioning lock: ${error.message}`);
  }
};

const clearProvisioningLock = () => {
  try {
    fs.rmSync(provisioningLockPath, { force: true });
  } catch (error) {
    console.warn(`▸ warning: could not clear provisioning lock: ${error.message}`);
  }
};

const writeStamp = (hash) => {
  try {
    fs.writeFileSync(
      stampPath,
      `${JSON.stringify(
        {
          requirementsSha256: hash,
          // Recorded so a CPU venv is never mistaken for a CUDA one: the hash
          // alone cannot tell them apart once a profile file is edited.
          profile: activeProfile,
          requirementsFile: resolvedRequirements.relativePath,
          installedAt: new Date().toISOString(),
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  } catch (error) {
    console.warn(`▸ warning: could not write install stamp: ${error.message}`);
  }
};

/**
 * Ask the venv's own interpreter whether the heavyweight imports resolve.
 *
 * This is the fallback used when no stamp is present. It deliberately checks
 * the packages that make a reinstall expensive (torch, onnxruntime) plus the
 * sidecar's own entry dependency (fastapi): if those three import cleanly the
 * venv is usable, and forcing a multi-GB reinstall would be pure waste.
 */
const queryVenv = (pythonPath) =>
  runImportQuery({
    pythonPath,
    modules: QUERY_MODULES,
    probe: queryProbe,
    spawnSync,
    timeout: QUERY_TIMEOUT_MS,
  });

const hasInstalledDependencies = () => queryVenv(venvPython).ok;

/**
 * "Ready" means: the interpreter exists AND the recorded fingerprint matches
 * the current requirements.txt. Returns a reason when it does not, so callers
 * can explain themselves to the user.
 */
const inspectReadiness = ({ adopt = false } = {}) => {
  if (!fs.existsSync(venvPython)) {
    return { ready: false, reason: "no .venv-mini virtualenv found" };
  }
  const expected = computeRequirementsHash();
  if (expected === null) {
    return { ready: false, reason: `cannot read packages/mini-backend/${resolvedRequirements.relativePath}` };
  }
  const stamp = readStamp();
  if (!stamp || typeof stamp.requirementsSha256 !== "string") {
    // Adoption is only sound for the CPU profile. The probe below checks
    // `fastapi, onnxruntime, torch`, all of which import fine in a CPU-only
    // venv — so adopting one as an accelerated venv would silently skip the
    // very wheels the profile exists to install.
    if (activeProfile !== DEFAULT_PROFILE) {
      return {
        ready: false,
        reason: `no install stamp, so profile "${activeProfile}" cannot be confirmed`,
      };
    }
    // A venv created before stamping existed (or one whose stamp was deleted)
    // still has every dependency on disk. Re-running a multi-GB pip install to
    // rediscover that would be indefensible, so probe the actual interpreter
    // instead and adopt it by back-filling the stamp when the probe passes.
    if (hasInstalledDependencies()) {
      // `--check` is a pure query, so only the mutating callers back-fill.
      if (adopt) writeStamp(expected);
      return {
        ready: true,
        reason: adopt
          ? "adopted an existing venv (install stamp back-filled)"
          : "existing venv satisfies requirements (no install stamp yet)",
      };
    }
    return { ready: false, reason: "dependencies were never installed for this venv" };
  }
  // The profile is checked before the hash so a CPU→CUDA switch reports the
  // real reason instead of the misleading "requirements changed".
  const stampedProfile = normalizeProfile(stamp.profile) ?? DEFAULT_PROFILE;
  if (stampedProfile !== activeProfile) {
    return {
      ready: false,
      reason: `venv was provisioned for profile "${stampedProfile}", not "${activeProfile}"`,
    };
  }
  if (stamp.requirementsSha256 !== expected) {
    return {
      ready: false,
      reason: `mini-backend/${resolvedRequirements.relativePath} changed since the last install`,
    };
  }
  return {
    ready: true,
    reason: `up to date (profile "${activeProfile}")`,
    stampedMatch: true,
  };
};

const run = (command, args, label) => {
  const result = spawnSync(command, args, { stdio: "inherit", cwd: rootDir });
  if (result.error) {
    throw new Error(`${label} failed to start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${label} exited with code ${result.status}`);
  }
};

const probe = (command, args) => {
  const result = spawnSync(command, args, { stdio: "ignore" });
  return !result.error && result.status === 0;
};

const directoryBytes = (directory) => {
  // A missing directory is zero bytes: a rebuild may be asked for a venv that
  // was never created, and that is not an error.
  if (!fs.existsSync(directory)) {
    return 0;
  }
  let total = 0;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      total += directoryBytes(entryPath);
    } else if (entry.isFile()) {
      total += fs.statSync(entryPath).size;
    }
  }
  return total;
};

const createVenvCommand = () => {
  const host = resolveHostPython();
  return { command: host.command, args: [...host.args, "-m", "venv", venvDir] };
};

const resolveHostPython = () => {
  const override = (process.env.MINI_BACKEND_PYTHON || "").trim();
  if (override) return { command: override, args: [] };

  const candidates = isWindows
    ? [
      { command: "py", args: ["-3.12"] },
      { command: "python", args: [] },
    ]
    : [
      { command: "python3.12", args: [] },
      { command: "python3", args: [] },
    ];

  for (const candidate of candidates) {
    if (probe(candidate.command, [...candidate.args, "--version"])) return candidate;
  }
  throw new Error(
    "No suitable Python found. Install Python 3.12 or set MINI_BACKEND_PYTHON to an interpreter path.",
  );
};

// Only the mutating entry points may back-fill a stamp; `--check` stays pure.
const readiness = inspectReadiness({ adopt: !withCheck });

// `--check` is a pure query used by other scripts; it must never mutate state.
if (withCheck) {
  const query = readiness.ready && readiness.stampedMatch ? queryVenv(venvPython) : null;
  const outcome = classifyTauriVerdict({ readiness, query });
  if (outcome.verdict === "ready") {
    console.log(`✓ mini-backend venv ready: ${path.relative(rootDir, venvPython)}`);
  } else if (outcome.verdict === "unusable") {
    console.log(`✖ mini-backend venv is provably unusable: ${outcome.reason}`);
  } else {
    console.log(`✖ mini-backend venv not ready: ${outcome.reason}`);
  }
  process.exit(outcome.exitCode);
}

// `--ensure` is the auto-bootstrap entry point: do nothing when the cached
// fingerprint still matches, otherwise fall through to a full install.
let recreateReason = withRecreate ? "a rebuild was requested" : null;
if (withEnsure && readiness.ready) {
  // A half-installed venv still carries the install stamp, so the stamp alone
  // cannot tell a good venv from a broken one — the import query can, and it
  // is the same query `--check` uses.
  const query = queryVenv(venvPython);
  if (query.ok) {
    console.log(`✓ mini-backend venv already provisioned (${readiness.reason}) — skipping install`);
    process.exit(0);
  }
  console.log(
    `▸ mini-backend venv is provisioned but its own interpreter fails the import query ` +
    `(${query.stderrTail}) — rebuilding it`,
  );
  recreateReason = "the venv failed its own import query";
}

if (withEnsure) {
  // Escape hatches. The install pulls PyTorch and friends (several GB), so it
  // must never be forced on someone who only wants the frontend, and it must
  // never fire unattended in CI.
  const skipRequested = ["1", "true", "yes"].includes(
    (process.env.KOMA_SKIP_MINI_BOOTSTRAP || "").trim().toLowerCase(),
  );
  const isCi = ["1", "true"].includes((process.env.CI || "").trim().toLowerCase());
  if (skipRequested || isCi) {
    console.warn(
      `▸ mini-backend venv not provisioned (${readiness.reason}), but auto-install is disabled ` +
      `by ${skipRequested ? "KOMA_SKIP_MINI_BOOTSTRAP" : "CI"}. ` +
      "The desktop app will start, but the Python sidecar will fail until you run " +
      "`bun run mini:install-deps`.",
    );
    process.exit(0);
  }
  console.log(`▸ mini-backend venv needs provisioning: ${readiness.reason}`);
  console.log("  This is a one-time setup and downloads several GB (PyTorch, CUDA wheels).");
  console.log("  Skip it with KOMA_SKIP_MINI_BOOTSTRAP=1 if you only need the frontend.");
}

if (!fs.existsSync(venvPython)) {
  const host = resolveHostPython();
  console.log(`▸ creating .venv-mini with ${host.command} ${host.args.join(" ")}`.trimEnd());
  run(host.command, [...host.args, "-m", "venv", venvDir], "venv creation");
} else {
  console.log("▸ .venv-mini already present");
}

const installRequirements = () => {
  // Publish the lock before the first byte is downloaded and clear it on every
  // exit path, so a crashed or cancelled install never leaves a stale lock that
  // would make the app wait forever.
  writeProvisioningLock();
  const pipCache = path.join(rootDir, ".cache", "pip");

  const requirementLines = readRequirementLines(requirementsPath);

  // PyPI's Windows torch wheels are CPU-only, and a CPU torch in a CUDA-profile
  // venv silently downgrades every torch-backed model. Pre-install the CUDA
  // build from the PyTorch index so the requirements pass below sees torch
  // satisfied, and filter the torch lines out of that pass entirely so a future
  // requirements bump can never quietly reintroduce the CPU wheel.
  const needsWindowsCudaTorch = isWindows && requiresNvidiaProviderProbe(activeProfile);
  let pipRequirementsPath = requirementsPath;
  if (needsWindowsCudaTorch) {
    const torchQuery = spawnSync(
      venvPython,
      ["-c", "import torch; print(torch.version.cuda or '')"],
      { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", timeout: QUERY_TIMEOUT_MS },
    );
    const torchCuda = torchQuery.status === 0 ? (torchQuery.stdout ?? "").trim() : "";
    if (torchCuda === "") {
      console.log(
        `▸ installing torch with CUDA support from ${TORCH_CUDA_INDEX_URL} (PyPI Windows wheels are CPU-only)`,
      );
      run(
        venvPython,
        [
          "-m", "pip", "install",
          "--cache-dir", pipCache,
          "--index-url", TORCH_CUDA_INDEX_URL,
          "--force-reinstall",
          "torch", "torchvision",
        ],
        "torch CUDA install",
      );
    }
    // A generated control file, next to the other `.koma-*` venv controls —
    // the shape guard in mini-venv-verdict.test.ts forbids extra deletion
    // targets in this script, so the file is simply overwritten per install.
    pipRequirementsPath = path.join(venvDir, ".koma-requirements-nvidia-windows.txt");
    fs.writeFileSync(pipRequirementsPath, `${withoutTorchLines(requirementLines).join("\n")}\n`);
  }

  // onnxruntime and onnxruntime-gpu share one package namespace: a leftover
  // variant of the wrong family overwrites the shared files and silently
  // strips the CUDA provider. Remove it and restore the pinned wheel so the
  // namespace always matches the active profile.
  const onnxruntimeRequirement = resolveOnnxruntimeRequirement(requirementLines);
  const onnxruntimeConflict = conflictingOnnxruntimeVariant(
    onnxruntimeVariantOf(onnxruntimeRequirement),
  );
  if (onnxruntimeConflict) {
    const uninstall = spawnSync(
      venvPython,
      ["-m", "pip", "uninstall", "-y", onnxruntimeConflict],
      { stdio: "inherit", cwd: rootDir },
    );
    if (uninstall.error || uninstall.status !== 0) {
      throw new Error(
        `pip uninstall ${onnxruntimeConflict} failed (exit ${uninstall.status ?? "spawn error"}) — ` +
        "the shared onnxruntime namespace would stay clobbered",
      );
    }
    run(
      venvPython,
      [
        "-m", "pip", "install",
        "--cache-dir", pipCache,
        "--force-reinstall", "--no-deps",
        onnxruntimeRequirement,
      ],
      "onnxruntime restore",
    );
  }

  // llama-cpp-python ships no wheel on PyPI, so a plain install downloads a
  // 74.9 MB sdist and compiles llama.cpp — tens of minutes, and it requires a
  // C++ toolchain (MSVC on Windows) most contributors do not have. The
  // maintainer publishes prebuilt CPU wheels, so install it from that index
  // first; the requirements pass below then sees it already satisfied.
  //
  // This runs as its own command, and *not* as a global `--extra-index-url` on
  // the main install, on purpose: an extra index is consulted for every package
  // name, which is the classic dependency-confusion footgun. Scoping it to the
  // single package that needs it keeps the other 26 pinned to PyPI.
  const llamaSpec = readLlamaRequirement(requirementLines);
  if (llamaSpec) {
    console.log(`▸ installing ${llamaSpec} from the prebuilt CPU wheel index (skips a source build)`);
    const wheelResult = spawnSync(
      venvPython,
      [
        "-m",
        "pip",
        "install",
        "--cache-dir",
        pipCache,
        "--extra-index-url",
        LLAMA_WHEEL_INDEX,
        llamaSpec,
      ],
      { stdio: "inherit", cwd: rootDir },
    );
    // A failure here is not fatal: the requirements pass below will fall back
    // to building from source, which is slow but still correct.
    if (wheelResult.error || wheelResult.status !== 0) {
      console.warn(
        "▸ warning: prebuilt llama-cpp-python wheel unavailable; falling back to a source build " +
        "(this can take tens of minutes and needs a C++ toolchain).",
      );
    }
  }

  run(
    venvPython,
    [
      "-m",
      "pip",
      "install",
      // Reuse pip's HTTP cache across runs and machines-with-a-warm-cache so a
      // re-provision after a requirements bump does not re-download every wheel.
      "--cache-dir",
      pipCache,
      "-r",
      pipRequirementsPath,
      "cython",
      "pyarmor",
    ],
    "pip install",
  );
  const hash = computeRequirementsHash();
  if (hash) writeStamp(hash);
  clearProvisioningLock();
};

const provisionAndVerify = () => {
  installRequirements();
  return classifyTauriVerdict({
    readiness: inspectReadiness({ adopt: false }),
    query: queryVenv(venvPython),
  });
};

/**
 * Rebuild the venv from scratch.
 *
 * A half-installed distribution cannot be repaired by reinstalling the
 * requirements: pip sees its `dist-info` on disk and reports it as already
 * satisfied, so the files that never landed stay missing. Deleting the venv is
 * the only way back to a known-good state.
 */
const recreateVenv = (reason) => {
  const create = createVenvCommand();
  return runRecreateOnce({
    venvDir,
    allowedVenvDir: path.resolve(venvDir),
    pythonPath: venvPython,
    reason,
    rmSync: fs.rmSync,
    existsSync: fs.existsSync,
    sizeOf: directoryBytes,
    createCommand: create.command,
    createArgs: create.args,
    run: (command, args) => run(command, args, "venv recreate"),
    install: provisionAndVerify,
    log: console.log,
  });
};

if (withInstall || withEnsure || withRecreate) {
  if (recreateReason !== null) {
    console.log(
      `▸ rebuilding .venv-mini for profile "${activeProfile}" ` +
      "(a half-installed venv cannot be repaired by reinstalling the requirements)",
    );
  } else {
    console.log(
      `▸ installing mini-backend requirements for profile "${activeProfile}" ` +
      `from mini-backend/${resolvedRequirements.relativePath} (first run downloads several GB)`,
    );
  }
  process.on("exit", clearProvisioningLock);
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      clearProvisioningLock();
      process.exit(1);
    });
  }

  let outcome = recreateReason !== null ? recreateVenv(recreateReason) : provisionAndVerify();
  if (outcome.exitCode === EXIT_UNUSABLE) {
    // A recreate never reports "unusable" (it already rebuilt and re-verified),
    // so this rung is only reachable from the install path.
    outcome = recreateVenv(outcome.reason);
  }
  if (outcome.exitCode !== 0) {
    console.error(`✖ mini-backend venv is not usable: ${outcome.reason}`);
    process.exit(outcome.exitCode);
  }
}

console.log(`✓ mini-backend venv ready: ${path.relative(rootDir, venvPython)}`);