import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { AUTH_SERVER_ERROR_CODES } from "@koma/types/desktopSession";

import { PROJECT_AUTH_ERROR_MESSAGES } from "../src/auth/error-normalization.js";

const SRC_DIR = fileURLToPath(new URL("../src/", import.meta.url));
const SOURCES = readdirSync(SRC_DIR, { recursive: true })
  .filter((name) => name.endsWith(".ts"))
  .map((name) => join(SRC_DIR, name));

test("every literal auth error code is in the shared contract", () => {
  const emitted = new Set<string>();
  for (const source of SOURCES) {
    const text = readFileSync(source, "utf8");
    for (const match of text.matchAll(/code:\s*["']([A-Z_]+)["']/g)) {
      if (match[1]) {
        emitted.add(match[1]);
      }
    }
  }

  assert.ok(emitted.size > 0, "scanner found no error codes; the source shape changed");
  const known = new Set<string>(AUTH_SERVER_ERROR_CODES);
  const missing = [...emitted].filter((code) => !known.has(code)).sort();
  assert.deepEqual(missing, []);
});

test("the normalized auth error catalog is in the shared contract", () => {
  const known = new Set<string>(AUTH_SERVER_ERROR_CODES);
  const missing = Object.keys(PROJECT_AUTH_ERROR_MESSAGES)
    .filter((code) => !known.has(code))
    .sort();
  assert.deepEqual(missing, []);
});

test("contract error codes are unique", () => {
  assert.equal(
    new Set(AUTH_SERVER_ERROR_CODES).size,
    AUTH_SERVER_ERROR_CODES.length,
  );
});
