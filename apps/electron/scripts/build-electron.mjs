import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { writeElectronTypecheckCache } from "./build-incremental-cache.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const skipTypecheck = args.includes("--skip-typecheck");

const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const parsed = {};
  const content = fs.readFileSync(filePath, "utf-8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "").trim();
    parsed[key] = value;
  }

  return parsed;
};

const loadProductionEnv = () => {
  const lookupOrder = [".env", ".env.local", ".env.production", ".env.production.local"];
  const merged = {};

  for (const envFile of lookupOrder) {
    Object.assign(merged, parseEnvFile(path.join(rootDir, envFile)));
  }

  return merged;
};

const FORBIDDEN_RUNTIME_CONFIG_KEYS = new Set([
  "DESKTOP_BOOTSTRAP_SECRET",
  "JWT_SECRET",
  "BETTER_AUTH_SECRET",
]);

const shouldSkipCertPinRefresh = () => {
  const normalized = (process.env.SKIP_CERT_PIN_REFRESH ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
};

const refreshCertificatePins = () => {
  if (shouldSkipCertPinRefresh()) {
    console.log("[build:electron] certificate pin refresh skipped via SKIP_CERT_PIN_REFRESH");
    return;
  }

  execSync("node scripts/refresh-cert-pins.mjs", {
    cwd: rootDir,
    stdio: "inherit",
    env: process.env,
    shell: true,
  });
};

const writeRuntimeConfig = () => {
  const productionEnv = loadProductionEnv();
  const keys = [
    "VITE_AUTH_API_URL",
    "VITE_LOCAL_API_URL",
    "VITE_AUTH_DISABLED",
    "AUTH_API_CERT_PINS_SHA256",
    "UPDATE_SERVER_CERT_PINS_SHA256",
    "DESKTOP_CLIENT_TOKEN_TTL_SECONDS",
    "DESKTOP_CLIENT_TOKEN_REFRESH_SKEW_SECONDS",
    "ENFORCE_DESKTOP_CLIENT",
    "UPDATE_PROVIDER",
    "UPDATE_SERVER_URL",
    "UPDATE_GITHUB_OWNER",
    "UPDATE_GITHUB_REPO",
    "UPDATE_CHANNEL",
    "UPDATE_ALLOW_PRERELEASE",
    "UPDATE_AUTO_DOWNLOAD",
    "UPDATE_AUTO_INSTALL_ON_QUIT",
    "DISCORD_RPC_CLIENT_ID",
    "DISCORD_CLIENT_ID",
    "VITE_DISCORD_CLIENT_ID",
    "KOMA_STUDIO_URL",
    "KOMA_STUDIO_DOWNLOAD_URL",
    "VITE_PROJECT_WEBSITE_URL",
    "VITE_PROJECT_DISCORD_URL",
    "BUG_REPORT_DISCORD_WEBHOOK_URL",
    "IMGUR_CLIENT_ID",
    "MINI_BACKEND_ACCELERATION_PROFILE",
    "MINI_BACKEND_ARTIFACTS_URL",
  ];

  const runtimeConfig = {};
  for (const key of keys) {
    const fromProcess = process.env[key];
    const fromEnvFile = productionEnv[key];
    const value = typeof fromProcess === "string" && fromProcess.trim().length > 0
      ? fromProcess.trim()
      : typeof fromEnvFile === "string" && fromEnvFile.trim().length > 0
        ? fromEnvFile.trim()
        : null;

    if (value !== null) {
      runtimeConfig[key] = value;
    }
  }

  for (const key of Object.keys(runtimeConfig)) {
    if (FORBIDDEN_RUNTIME_CONFIG_KEYS.has(key)) {
      throw new Error(`[build:electron] runtime-config contains forbidden key: ${key}`);
    }
  }

  const distElectronDir = path.join(rootDir, "dist-electron");
  fs.mkdirSync(distElectronDir, { recursive: true });

  const outputPath = path.join(distElectronDir, "runtime-config.json");
  fs.writeFileSync(outputPath, JSON.stringify(runtimeConfig, null, 2));
  console.log(
    `[build:electron] runtime-config.json atualizado com ${Object.keys(runtimeConfig).length} chaves`,
  );
};

const main = () => {
  refreshCertificatePins();

  if (!skipTypecheck) {
    execSync("tsc -p tsconfig.node.json", {
      cwd: rootDir,
      stdio: "inherit",
      env: process.env,
      shell: true,
    });

    const { cacheDir } = writeElectronTypecheckCache(rootDir);
    console.log(`[build:electron] electron typecheck cache updated at ${cacheDir}`);
  } else {
    console.log("[build:electron] skipping TypeScript typecheck (--skip-typecheck)");
  }

  writeRuntimeConfig();
};

main();
