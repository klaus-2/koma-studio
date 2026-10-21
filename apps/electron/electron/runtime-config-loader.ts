/**
 * Loads runtime-config.json, handling both plain and hardened formats.
 * The hardened format is produced by harden-electron.mjs and uses
 * AES-256-GCM authenticated encryption to protect config values at rest.
 *
 * Decode logic (v2 GCM, v1 XOR, unknown-version GCM→XOR fallback) lives in
 * modules/runtime-config-decode.ts — this wrapper only performs file IO.
 */

import fs from "node:fs";
import path from "node:path";

import { decodeProtectedConfig } from "./modules/runtime-config-decode.ts";

/**
 * Load and decode runtime-config.json from the given directory.
 * Supports plain JSON, v2 AES-256-GCM, and v1 XOR (legacy) formats.
 */
export function loadRuntimeConfig(configDir: string): Record<string, string> {
  const configPath = path.join(configDir, "runtime-config.json");

  if (!fs.existsSync(configPath)) {
    return {};
  }

  const raw = fs.readFileSync(configPath, "utf-8");
  const parsed: unknown = JSON.parse(raw);

  if (
    parsed !== null
    && typeof parsed === "object"
    && (parsed as { _protected?: unknown })._protected === true
    && typeof (parsed as { _d?: unknown })._d === "string"
  ) {
    return decodeProtectedConfig(parsed as Record<string, unknown>);
  }

  return parsed as Record<string, string>;
}
