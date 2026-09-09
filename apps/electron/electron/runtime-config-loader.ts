/**
 * Loads runtime-config.json, handling both plain and hardened formats.
 * The hardened format is produced by harden-electron.mjs and uses
 * AES-256-GCM authenticated encryption to protect config values at rest.
 */

import fs from "node:fs";
import path from "node:path";
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
// Fragments stored in scrambled order — reassembled via _ko index map
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

function _reconstituteKey(): Buffer {
  return Buffer.from(_ko.map((i) => _kp[i]).join(""), "hex");
}

/**
 * Decrypt a v2 AES-256-GCM protected config.
 */
function decodeGCMConfig(config: GCMProtectedConfig): Record<string, string> {
  const key = _reconstituteKey();
  const iv = Buffer.from(config._iv, "hex");
  const encrypted = Buffer.from(config._d, "base64");
  const authTag = Buffer.from(config._tag, "hex");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return JSON.parse(decrypted.toString("utf-8"));
}

/**
 * Decrypt a v1 XOR-protected config (legacy fallback).
 */
function decodeXORConfig(config: XORProtectedConfig): Record<string, string> {
  const xored = Buffer.from(config._d, "base64");
  for (let i = 0; i < xored.length; i++) {
    xored[i] ^= config._k;
  }
  const json = Buffer.from(xored.toString("utf-8"), "base64").toString("utf-8");
  return JSON.parse(json);
}

/**
 * Decode any protected config format, with automatic version detection.
 */
export function decodeProtectedConfig(parsed: Record<string, unknown>): Record<string, string> {
  const version = parsed._v as number | undefined;

  if (version === 2) {
    return decodeGCMConfig(parsed as unknown as GCMProtectedConfig);
  }

  if (version === 1) {
    return decodeXORConfig(parsed as unknown as XORProtectedConfig);
  }

  // Unknown version — try GCM first, then XOR as fallback
  try {
    return decodeGCMConfig(parsed as unknown as GCMProtectedConfig);
  } catch {
    return decodeXORConfig(parsed as unknown as XORProtectedConfig);
  }
}

/**
 * Load and decode runtime-config.json from the dist-electron directory.
 * Supports plain JSON, v2 AES-256-GCM, and v1 XOR (legacy) formats.
 */
export function loadRuntimeConfig(configDir: string): Record<string, string> {
  const configPath = path.join(configDir, "runtime-config.json");

  if (!fs.existsSync(configPath)) {
    return {};
  }

  const raw = fs.readFileSync(configPath, "utf-8");
  const parsed = JSON.parse(raw);

  if (parsed._protected === true && typeof parsed._d === "string") {
    return decodeProtectedConfig(parsed as Record<string, unknown>);
  }

  return parsed;
}
