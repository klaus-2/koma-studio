import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { tServer } from "../src/services/server-i18n.ts";


const SRC = new URL("../src", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

const collectTsFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? collectTsFiles(full) : full.endsWith(".ts") ? [full] : [];
  });

const translationKeysIn = (source: string): { key: string; dynamic: boolean }[] => {
  const found: { key: string; dynamic: boolean }[] = [];
  for (let i = source.indexOf("tServer("); i !== -1; i = source.indexOf("tServer(", i + 1)) {
    let depth = 0;
    let end = i;
    for (let j = i + "tServer".length; j < source.length; j++) {
      if (source[j] === "(") depth += 1;
      else if (source[j] === ")" && (depth -= 1) === 0) {
        end = j;
        break;
      }
    }
    const args = source.slice(i + "tServer".length, end);
    const literal = args.match(/["']([^"']+)["']\s*\)?\s*$/);
    if (literal && literal[1].includes(".")) {
      found.push({ key: literal[1], dynamic: false });
    } else {
      found.push({ key: args.trim(), dynamic: true });
    }
  }
  return found;
};

const calls = collectTsFiles(SRC).flatMap((file) =>
  translationKeysIn(readFileSync(file, "utf8")).map((entry) => ({ ...entry, file })),
);
const staticKeys = [...new Set(calls.filter((c) => !c.dynamic).map((c) => c.key))];

test("the scanner actually reads the source", () => {
  assert.ok(
    staticKeys.length >= 60,
    `expected at least 60 literal tServer keys, found ${staticKeys.length}`,
  );
  assert.ok(staticKeys.includes("auth.error.sessionRevoked"), "the key that caused the incident");
  assert.ok(staticKeys.includes("auth.error.invalidToken"), "a sibling key from the same file");
});

test("every literal tServer key resolves in the en catalog instead of echoing back", () => {
  const leaks = staticKeys
    .map((key) => ({ key, value: tServer("en", key) }))
    .filter(({ key, value }) => value === key);

  assert.deepEqual(
    leaks,
    [],
    `${leaks.length} key(s) render as their own name: ${leaks.map((l) => l.key).join(", ")}`,
  );
});

test("no locale falls through to the raw key", () => {
  const leaks: string[] = [];
  for (const key of staticKeys) {
    for (const locale of ["pt-br", "pt", "es", "ja", "ar", "zh"] as const) {
      if (tServer(locale, key) === key) leaks.push(`${locale}:${key}`);
    }
  }
  assert.deepEqual(leaks, [], `keys unresolved in a locale: ${leaks.join(", ")}`);
});
