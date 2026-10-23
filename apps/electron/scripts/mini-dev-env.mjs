import fs from "node:fs";
import path from "node:path";
import process from "node:process";

export const ACCELERATION_PROFILE_KEY = "MINI_BACKEND_ACCELERATION_PROFILE";

const ENV_FILE_PRECEDENCE = [
  ".env.development.local",
  ".env.local",
  ".env.development",
  ".env",
];

const findEnvFileEntry = (rootDir, key) => {
  const pattern = new RegExp(`^\\s*${key}\\s*=\\s*["']?([^"'\\r\\n#]+)["']?`, "m");
  for (const fileName of ENV_FILE_PRECEDENCE) {
    const filePath = path.join(rootDir, fileName);
    if (!fs.existsSync(filePath)) {
      continue;
    }
    const match = fs.readFileSync(filePath, "utf8").match(pattern);
    if (match) {
      return { fileName, value: match[1] };
    }
  }
  return null;
};

export const readEnvFileValue = (rootDir, key) =>
  findEnvFileEntry(rootDir, key)?.value ?? "";

export const AUTH_DISABLED_KEY = "VITE_AUTH_DISABLED";

// Same rule as packages/types/src/auth-disabled.ts with the dev fallback baked
// in, so only the explicit falsy tokens need a list. It cannot import that
// module: mini-bootstrap-skip.test.mjs copies this file into a throwaway
// project under the OS temp directory, where no node_modules exists above it.
// The parity test in mini-dev-env.test.mjs keeps the two from drifting.
const FALSY_FLAGS = ["false", "0", "no"];

/**
 * Reads the `VITE_AUTH_DISABLED` lever for the dev stack with the renderer's
 * three states. A dev stack that decides otherwise can start without the auth
 * server while the app still demands a login. Unset or unreadable means
 * local-only: a fresh clone has no PostgreSQL or Redis to run that server.
 */
export const resolveAuthDisabled = (rootDir, env = process.env) => {
  const declared = [
    env[AUTH_DISABLED_KEY] ?? "",
    readEnvFileValue(rootDir, AUTH_DISABLED_KEY),
  ].find((raw) => raw.trim() !== "");

  if (declared === undefined) {
    return true;
  }

  const value = declared.trim().toLowerCase();

  // Anything but an explicit falsy token stays local-only, matching the
  // renderer's fallback for an unreadable value.
  return !FALSY_FLAGS.includes(value);
};

export const resolveAccelerationProfile = (rootDir, env = process.env) => {
  const fromProcess = (env[ACCELERATION_PROFILE_KEY] ?? "").trim();
  if (fromProcess !== "") {
    return { profile: fromProcess.toLowerCase(), source: "process.env" };
  }

  const entry = findEnvFileEntry(rootDir, ACCELERATION_PROFILE_KEY);
  const fromFile = (entry?.value ?? "").trim();
  if (fromFile !== "") {
    return { profile: fromFile.toLowerCase(), source: entry.fileName };
  }

  return { profile: "", source: "undeclared" };
};

export const withAccelerationProfile = (env, profile) => ({
  ...env,
  [ACCELERATION_PROFILE_KEY]: profile,
});

const SKIP_TRUTHY = ["1", "true", "yes"];
const CI_TRUTHY = ["1", "true"];

const isTruthy = (value, truthy) => truthy.includes((value ?? "").trim().toLowerCase());

export const shouldSkipMiniBootstrap = (env = process.env) => {
  if (isTruthy(env.KOMA_SKIP_MINI_BOOTSTRAP, SKIP_TRUTHY)) {
    return { skip: true, source: "KOMA_SKIP_MINI_BOOTSTRAP" };
  }
  if (isTruthy(env.CI, CI_TRUTHY)) {
    return { skip: true, source: "CI" };
  }
  return { skip: false, source: "" };
};
