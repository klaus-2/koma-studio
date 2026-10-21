import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import { DESKTOP_SESSION_ERROR_CODES } from "@koma/types/desktopSession";

const ROUTES_DIR = new URL("../src/routes/", import.meta.url);
const ROUTE_SOURCES = readdirSync(ROUTES_DIR)
  .filter((name) => name.endsWith(".ts"))
  .map((name) => new URL(name, ROUTES_DIR));

test("every route error code is in the shared contract", () => {
  const emitted = new Set<string>();
  for (const source of ROUTE_SOURCES) {
    const text = readFileSync(source, "utf8");
    for (const match of text.matchAll(/code:\s*["']([A-Z_]+)["']/g)) {
      if (match[1]) {
        emitted.add(match[1]);
      }
    }
  }

  assert.ok(emitted.size > 0, "scanner found no error codes; the source shape changed");
  const known = new Set<string>(DESKTOP_SESSION_ERROR_CODES);
  const missing = [...emitted].filter((code) => !known.has(code)).sort();
  assert.deepEqual(missing, []);
});

test("contract error codes are unique", () => {
  assert.equal(
    new Set(DESKTOP_SESSION_ERROR_CODES).size,
    DESKTOP_SESSION_ERROR_CODES.length,
  );
});
