#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { EXIT_UNUSABLE } from "./lib/mini-venv-verdict.mjs";

const SKIP_TRUTHY = ["1", "true", "yes"];
const CI_TRUTHY = ["1", "true"];

const isTruthy = (value, truthy) => truthy.includes((value ?? "").trim().toLowerCase());

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Whether the gate is deliberately disabled.
 *
 * A disabled gate opens the app without a proven Python sidecar, so it must
 * also skip the rebuild: the opt-out is about leaving the venv alone.
 */
export const gateDisabledByEnv = (env) => {
  const skipRequested = isTruthy(env.KOMA_SKIP_MINI_BOOTSTRAP, SKIP_TRUTHY);
  const isCi = isTruthy(env.CI, CI_TRUTHY);
  return {
    disabled: skipRequested || isCi,
    reason: skipRequested ? "KOMA_SKIP_MINI_BOOTSTRAP" : isCi ? "CI" : "",
  };
};

/**
 * A venv that failed its own import query is provably broken, and a broken
 * venv has to be rebuilt rather than merely reported: the desktop app cannot
 * do anything useful without its sidecar, and the rebuild is the one thing
 * that unblocks it. A half-installed venv cannot be repaired by reinstalling
 * the requirements (pip reports those distributions as already satisfied), so
 * the rebuild replaces the venv outright.
 */
export const shouldRebuild = (checkExitCode, env) =>
  checkExitCode === EXIT_UNUSABLE && !gateDisabledByEnv(env).disabled;

export const evaluateGate = (checkExitCode, env) => {
  const { disabled, reason } = gateDisabledByEnv(env);
  if (disabled) {
    return {
      blocked: false,
      exitCode: 0,
      notice:
        `▸ mini-backend startup gate disabled by ${reason}: ` +
        "the app opens without a proven Python sidecar. It will fail at the first backend call " +
        "until you run `bun run mini:install-deps`.",
    };
  }
  if (checkExitCode === EXIT_UNUSABLE) {
    return {
      blocked: true,
      exitCode: EXIT_UNUSABLE,
      notice:
        "✖ mini-backend venv is provably unusable (its own reason line is above). Refusing to open a " +
        "desktop app whose Python sidecar is doomed to die. Rebuild it with " +
        "`bun run mini:repair` (or `bun run mini:install-deps`), or skip this gate on purpose with " +
        "KOMA_SKIP_MINI_BOOTSTRAP=1 (CI does the same).",
    };
  }
  return { blocked: false, exitCode: 0, notice: "" };
};

const isDirectExecution = (() => {
  if (!process.argv[1]) {
    return false;
  }

  try {
    return import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
})();

const runMiniVenv = (args) =>
  spawnSync(process.execPath, [path.join(rootDir, "scripts", "mini-venv.mjs"), ...args], {
    stdio: "inherit",
    cwd: rootDir,
  });

if (isDirectExecution) {
  let check = runMiniVenv(["--check"]);
  if (shouldRebuild(check.status ?? 1, process.env)) {
    console.warn(
      "▸ mini-backend venv is provably unusable — rebuilding it now " +
      "(this replaces the venv and downloads several GB again).",
    );
    const rebuild = runMiniVenv(["--recreate"]);
    if (rebuild.status === 0) {
      check = runMiniVenv(["--check"]);
    }
  }
  const verdict = evaluateGate(check.status ?? 1, process.env);
  if (verdict.notice !== "") {
    if (verdict.blocked) {
      console.error(verdict.notice);
    } else {
      console.warn(verdict.notice);
    }
  }
  process.exit(verdict.exitCode);
}
