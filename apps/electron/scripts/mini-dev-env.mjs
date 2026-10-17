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
