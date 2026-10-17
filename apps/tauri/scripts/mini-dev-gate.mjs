#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { EXIT_UNUSABLE } from "./lib/mini-venv-verdict.mjs";

const SKIP_TRUTHY = ["1", "true", "yes"];
const CI_TRUTHY = ["1", "true"];

const isTruthy = (value, truthy) => truthy.includes((value ?? "").trim().toLowerCase());

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const evaluateGate = (checkExitCode, env) => {
  const skipRequested = isTruthy(env.KOMA_SKIP_MINI_BOOTSTRAP, SKIP_TRUTHY);
  const isCi = isTruthy(env.CI, CI_TRUTHY);
  if (skipRequested || isCi) {
    return {
      blocked: false,
      exitCode: 0,
      notice:
        `▸ mini-backend startup gate disabled by ${skipRequested ? "KOMA_SKIP_MINI_BOOTSTRAP" : "CI"}: ` +
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
        "desktop app whose Python sidecar is doomed to die. Repair it with " +
        "`bun run mini:install-deps`, or skip this gate on purpose with KOMA_SKIP_MINI_BOOTSTRAP=1 " +
        "(CI does the same).",
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

if (isDirectExecution) {
  const check = spawnSync(
    process.execPath,
    [path.join(rootDir, "scripts", "mini-venv.mjs"), "--check"],
    { stdio: "inherit", cwd: rootDir },
  );
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
