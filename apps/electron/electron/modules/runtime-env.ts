/**
 * Desktop env / protected runtime-config resolution.
 */
import { app } from "electron";
import { createDecipheriv } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

let desktopIsDev = false;

const setDesktopIsDev = (value: boolean): void => {
  desktopIsDev = value;
};

const readValueFromEnvFile = (filePath: string, key: string): string | null => {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }
      const delimiterIndex = line.indexOf("=");
      if (delimiterIndex <= 0) {
        continue;
      }

      const parsedKey = line.slice(0, delimiterIndex).trim();
      if (parsedKey !== key) {
        continue;
      }

      const rawValue = line.slice(delimiterIndex + 1).trim();
      const normalized = rawValue.replace(/^['"]|['"]$/g, "").trim();
      return normalized.length > 0 ? normalized : "";
    }
  } catch {
    return null;
  }

  return null;
};

// AES-256 key fragments for runtime-config decryption (recombined at runtime, obfuscated at build time)
// Fragments stored in scrambled order — reassembled via _rco index map
const _rck: string[] = [
  "8fbd7712", // fragment index 4
  "331225c7", // fragment index 0
  "9b5684f4", // fragment index 7
  "868ff43e", // fragment index 1
  "d55fe1ba", // fragment index 5
  "9783e807", // fragment index 2
  "7126d4d6", // fragment index 6
  "37c1fc2a", // fragment index 3
];
const _rco = [1, 3, 5, 7, 0, 4, 6, 2]; // reassembly order

const decodeProtectedRuntimeConfig = (
  parsed: Record<string, unknown>,
): Record<string, string> => {
  const version = parsed._v as number | undefined;
  const key = Buffer.from(_rco.map((i) => _rck[i]!).join(""), "hex");

  if (version === 2) {
    const cfg = parsed as { _d: string; _iv: string; _tag: string };
    const iv = Buffer.from(cfg._iv, "hex");
    const encrypted = Buffer.from(cfg._d, "base64");
    const authTag = Buffer.from(cfg._tag, "hex");

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return JSON.parse(decrypted.toString("utf-8"));
  }

  // v1 XOR fallback (legacy configs)
  const cfg = parsed as { _d: string; _k: number };
  const xored = Buffer.from(cfg._d, "base64");
  for (let i = 0; i < xored.length; i++) {
    xored[i]! ^= cfg._k;
  }
  const json = Buffer.from(xored.toString("utf-8"), "base64").toString("utf-8");
  return JSON.parse(json);
};

const readRuntimeConfigFile = (filePath: string): Record<string, string> | null => {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const maybeProtected = parsed as Record<string, unknown>;
    if (maybeProtected._protected === true && typeof maybeProtected._d === "string") {
      return decodeProtectedRuntimeConfig(maybeProtected);
    }

    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value !== "string") {
        continue;
      }
      normalized[key] = value;
    }

    return normalized;
  } catch {
    return null;
  }
};

let cachedDesktopRuntimeConfig: Record<string, string> | null | undefined;
const FORBIDDEN_RUNTIME_CONFIG_KEYS = new Set([
  "DESKTOP_BOOTSTRAP_SECRET",
  "JWT_SECRET",
  "BETTER_AUTH_SECRET",
]);

const sanitizeRuntimeConfig = (runtimeConfig: Record<string, string>): Record<string, string> => {
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(runtimeConfig)) {
    if (FORBIDDEN_RUNTIME_CONFIG_KEYS.has(key)) {
      console.warn(`[desktop-security] Ignoring forbidden runtime-config key: ${key}`);
      continue;
    }
    sanitized[key] = value;
  }
  return sanitized;
};

const resolveRuntimeConfigValue = (key: string): string | null => {
  if (FORBIDDEN_RUNTIME_CONFIG_KEYS.has(key)) {
    return null;
  }

  if (cachedDesktopRuntimeConfig === undefined) {
    const runtimeConfigCandidates = [
      path.resolve(process.cwd(), "dist-electron", "runtime-config.json"),
      path.resolve(process.cwd(), "runtime-config.json"),
      path.resolve(process.resourcesPath, "app.asar", "dist-electron", "runtime-config.json"),
      path.resolve(process.resourcesPath, "dist-electron", "runtime-config.json"),
    ];

    let loadedConfig: Record<string, string> | null = null;
    for (const candidatePath of runtimeConfigCandidates) {
      const parsed = readRuntimeConfigFile(candidatePath);
      if (parsed) {
        loadedConfig = sanitizeRuntimeConfig(parsed);
        break;
      }
    }

    cachedDesktopRuntimeConfig = loadedConfig;
  }

  const value = cachedDesktopRuntimeConfig?.[key];
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : "";
};

const getDesktopEnvFileName = (): ".env.production" | ".env.development" => {
  const nodeEnv = (process.env.NODE_ENV ?? "").trim().toLowerCase();
  if (nodeEnv === "production") {
    return ".env.production";
  }

  if (nodeEnv === "development") {
    return ".env.development";
  }

  return app.isPackaged ? ".env.production" : ".env.development";
};

const collectAncestorDirs = (startDir: string, maxDepth: number): string[] => {
  const ancestors: string[] = [];
  let current = path.resolve(startDir);
  for (let depth = 0; depth < maxDepth; depth += 1) {
    ancestors.push(current);
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return ancestors;
};

const resolveDesktopEnvFileValue = (key: string): string | null => {
  const envFile = getDesktopEnvFileName();
  const rootCandidates = Array.from(
    new Set<string>([
      process.cwd(),
      path.dirname(process.execPath),
      process.resourcesPath,
      ...collectAncestorDirs(process.cwd(), 6),
      ...collectAncestorDirs(path.dirname(process.execPath), 8),
      ...collectAncestorDirs(process.resourcesPath, 6),
    ]),
  );

  const lookupOrder: string[] = [];
  for (const rootCandidate of rootCandidates) {
    const rootEnvPaths = [
      path.resolve(rootCandidate, `${envFile}.local`),
      path.resolve(rootCandidate, ".env.local"),
      path.resolve(rootCandidate, envFile),
      path.resolve(rootCandidate, ".env"),
    ];
    const authServerEnvPaths = [
      path.resolve(rootCandidate, "auth-server", `${envFile}.local`),
      path.resolve(rootCandidate, "auth-server", ".env.local"),
      path.resolve(rootCandidate, "auth-server", envFile),
      path.resolve(rootCandidate, "auth-server", ".env"),
    ];
    lookupOrder.push(...rootEnvPaths, ...authServerEnvPaths);
  }

  for (const candidatePath of lookupOrder) {
    const value = readValueFromEnvFile(candidatePath, key);
    if (value !== null) {
      return value;
    }
  }

  return null;
};

const resolveDesktopEnvValue = (key: string): string | null => {
  const fromProcess = process.env[key]?.trim();
  if (fromProcess && fromProcess.length > 0) {
    return fromProcess;
  }

  if (desktopIsDev) {
    const fromEnvFile = resolveDesktopEnvFileValue(key);
    if (fromEnvFile !== null) {
      return fromEnvFile;
    }
  }

  const fromRuntimeConfig = resolveRuntimeConfigValue(key);
  if (fromRuntimeConfig !== null) {
    return fromRuntimeConfig;
  }

  return resolveDesktopEnvFileValue(key);
};

export {
  resolveDesktopEnvValue,
  resolveRuntimeConfigValue,
  setDesktopIsDev,
};
