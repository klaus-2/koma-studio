/**
 * Decoding of protected runtime-config.json payloads (AES-256-GCM v2 and the
 * legacy v1 XOR format). Shared by both load wrappers so the key material and
 * the unknown-version GCM→XOR fallback live in exactly one place.
 * Pure node — no electron imports — unit-testable under node:test.
 */

import { createDecipheriv } from "node:crypto";

interface GCMProtectedConfig {
  _protected: true;
  _v: 2;
  _d: string; // base64(encrypted json)
  _iv: string; // hex-encoded IV
  _tag: string; // hex-encoded GCM auth tag
}

interface XORProtectedConfig {
  _protected: true;
  _v: 1;
  _d: string; // base64(xor(base64(json)))
  _k: number; // XOR key
}

// AES-256 key split into fragments to hinder static analysis (recombined at runtime)
// Fragments stored in scrambled order — reassembled via _ko index map.
// MUST produce the same key as the fragments baked by scripts/harden-electron.mjs.
const _kp: string[] = [
  "9783e807", // fragment index 2
  "37c1fc2a", // fragment index 3
  "331225c7", // fragment index 0
  "d55fe1ba", // fragment index 5
  "9b5684f4", // fragment index 7
  "868ff43e", // fragment index 1
  "7126d4d6", // fragment index 6
  "8fbd7712", // fragment index 4
];
const _ko = [2, 5, 0, 1, 7, 3, 6, 4]; // reassembly order

const reconstituteKey = (): Buffer => {
  return Buffer.from(_ko.map((i) => _kp[i] ?? "").join(""), "hex");
};

const decodeGCMConfig = (config: GCMProtectedConfig): Record<string, string> => {
  const key = reconstituteKey();
  const iv = Buffer.from(config._iv, "hex");
  const encrypted = Buffer.from(config._d, "base64");
  const authTag = Buffer.from(config._tag, "hex");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return JSON.parse(decrypted.toString("utf-8"));
};

const decodeXORConfig = (config: XORProtectedConfig): Record<string, string> => {
  const xored = Buffer.from(config._d, "base64");
  for (let i = 0; i < xored.length; i++) {
    xored[i] ^= config._k;
  }
  const json = Buffer.from(xored.toString("utf-8"), "base64").toString("utf-8");
  return JSON.parse(json);
};

const asGCMConfig = (parsed: Record<string, unknown>): GCMProtectedConfig | null => {
  if (
    typeof parsed._d === "string"
    && typeof parsed._iv === "string"
    && typeof parsed._tag === "string"
  ) {
    return { _protected: true, _v: 2, _d: parsed._d, _iv: parsed._iv, _tag: parsed._tag };
  }
  return null;
};

const asXORConfig = (parsed: Record<string, unknown>): XORProtectedConfig | null => {
  if (typeof parsed._d === "string" && typeof parsed._k === "number") {
    return { _protected: true, _v: 1, _d: parsed._d, _k: parsed._k };
  }
  return null;
};

/**
 * Decode any protected config format, with automatic version detection.
 * Unknown or absent version: try GCM first, then XOR as legacy fallback.
 */
export function decodeProtectedConfig(parsed: Record<string, unknown>): Record<string, string> {
  const version = parsed._v;

  if (version === 2) {
    const gcm = asGCMConfig(parsed);
    if (gcm) {
      return decodeGCMConfig(gcm);
    }
    throw new Error("invalid v2 protected config payload");
  }

  if (version === 1) {
    const xor = asXORConfig(parsed);
    if (xor) {
      return decodeXORConfig(xor);
    }
    throw new Error("invalid v1 protected config payload");
  }

  const gcm = asGCMConfig(parsed);
  if (gcm) {
    try {
      return decodeGCMConfig(gcm);
    } catch {
      // GCM attempt failed — fall through to the legacy XOR path.
    }
  }

  const xor = asXORConfig(parsed);
  if (xor) {
    return decodeXORConfig(xor);
  }

  throw new Error("unrecognized protected config payload");
}
