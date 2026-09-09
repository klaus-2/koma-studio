import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import tls from "node:tls";
import { createHash, X509Certificate } from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const DEFAULT_ENV_FILES = [
  ".env.production",
  ".env.production.local",
  ".env.development",
  ".env.development.local",
];

const PIN_RULES = [
  {
    urlKey: "VITE_AUTH_API_URL",
    pinKey: "AUTH_API_CERT_PINS_SHA256",
    label: "auth",
  },
  {
    urlKey: "UPDATE_SERVER_URL",
    pinKey: "UPDATE_SERVER_CERT_PINS_SHA256",
    label: "update",
  },
];

const normalizeBoolean = (value) => {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
};

const shouldRunInStrictMode = normalizeBoolean(process.env.STRICT_CERT_PIN_REFRESH);
const shouldUpdateExampleFile = normalizeBoolean(process.env.UPDATE_EXAMPLE_CERT_PINS);

const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const parsed = {};
  const content = fs.readFileSync(filePath, "utf8");
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
    parsed[key] = rawValue.replace(/^['"]|['"]$/g, "").trim();
  }

  return parsed;
};

const detectLineEnding = (content) => (content.includes("\r\n") ? "\r\n" : "\n");

const updateEnvContent = (content, updates) => {
  const eol = detectLineEnding(content);
  const lines = content.split(/\r?\n/);
  const seenKeys = new Set();

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const match = line.match(/^(\s*)([A-Za-z0-9_]+)(\s*=\s*)(.*)$/);
    if (!match) {
      continue;
    }

    const key = match[2];
    if (!Object.prototype.hasOwnProperty.call(updates, key)) {
      continue;
    }

    lines[index] = `${match[1]}${key}=${updates[key]}`;
    seenKeys.add(key);
  }

  for (const [key, value] of Object.entries(updates)) {
    if (seenKeys.has(key)) {
      continue;
    }
    lines.push(`${key}=${value}`);
  }

  return lines.join(eol);
};

const resolveLookupCacheKey = (url) => `${url.hostname}:${url.port || "443"}`;

const fetchSpkiPin = async (rawUrl) => {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== "https:") {
    return null;
  }

  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      {
        host: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : 443,
        servername: parsed.hostname,
        rejectUnauthorized: false,
      },
      () => {
        try {
          const certificate = socket.getPeerCertificate(true);
          if (!certificate?.raw) {
            throw new Error(`No peer certificate returned for ${parsed.hostname}`);
          }

          const x509 = new X509Certificate(certificate.raw);
          const spki = x509.publicKey.export({ type: "spki", format: "der" });
          const pin = createHash("sha256").update(spki).digest("hex").toUpperCase();
          socket.end();
          resolve(pin);
        } catch (error) {
          socket.destroy();
          reject(error);
        }
      },
    );

    socket.setTimeout(10_000, () => {
      socket.destroy(new Error(`TLS timeout while fetching certificate for ${parsed.hostname}`));
    });
    socket.on("error", (error) => {
      reject(error);
    });
  });
};

const refreshPinsForEnvFile = async (relativeFilePath, pinCache) => {
  const absoluteFilePath = path.join(rootDir, relativeFilePath);
  if (!fs.existsSync(absoluteFilePath)) {
    return { updated: false, skipped: true, warnings: [] };
  }

  const envValues = parseEnvFile(absoluteFilePath);
  const updates = {};
  const warnings = [];

  for (const rule of PIN_RULES) {
    const rawUrl = envValues[rule.urlKey];
    if (!rawUrl) {
      continue;
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      warnings.push(`[cert-pins] ${relativeFilePath}: invalid URL for ${rule.urlKey} (${rawUrl})`);
      continue;
    }

    if (parsedUrl.protocol !== "https:") {
      continue;
    }

    const cacheKey = resolveLookupCacheKey(parsedUrl);
    let pin = pinCache.get(cacheKey) ?? null;
    if (!pin) {
      try {
        pin = await fetchSpkiPin(parsedUrl.toString());
        if (pin) {
          pinCache.set(cacheKey, pin);
        }
      } catch (error) {
        const warning = `[cert-pins] ${relativeFilePath}: failed to refresh ${rule.label} pin for ${parsedUrl.host}: ${
          error instanceof Error ? error.message : String(error)
        }`;
        warnings.push(warning);
        continue;
      }
    }

    if (pin) {
      updates[rule.pinKey] = pin;
    }
  }

  if (Object.keys(updates).length === 0) {
    return { updated: false, skipped: false, warnings };
  }

  const original = fs.readFileSync(absoluteFilePath, "utf8");
  const next = updateEnvContent(original, updates);
  if (next !== original) {
    fs.writeFileSync(absoluteFilePath, next, "utf8");
    return { updated: true, skipped: false, warnings, updates };
  }

  return { updated: false, skipped: false, warnings, updates };
};

const main = async () => {
  const envFiles = shouldUpdateExampleFile
    ? [...DEFAULT_ENV_FILES, ".env.example"]
    : DEFAULT_ENV_FILES;
  const pinCache = new Map();
  const warnings = [];
  let updatedCount = 0;

  console.log("[cert-pins] Refreshing certificate pins...");

  for (const envFile of envFiles) {
    const result = await refreshPinsForEnvFile(envFile, pinCache);
    warnings.push(...result.warnings);
    if (result.updated) {
      updatedCount += 1;
      const updatedKeys = Object.entries(result.updates ?? {})
        .map(([key, value]) => `${key}=${value}`)
        .join(" ");
      console.log(`[cert-pins] Updated ${envFile}: ${updatedKeys}`);
    }
  }

  warnings.forEach((warning) => console.warn(warning));

  if (warnings.length > 0 && shouldRunInStrictMode) {
    throw new Error("Certificate pin refresh finished with warnings in strict mode.");
  }

  if (updatedCount === 0) {
    console.log("[cert-pins] No pin changes were necessary.");
  } else {
    console.log(`[cert-pins] Refresh complete. Updated ${updatedCount} file(s).`);
  }
};

main().catch((error) => {
  console.error(`[cert-pins] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
