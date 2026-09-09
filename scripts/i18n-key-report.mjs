#!/usr/bin/env node
// i18n key detector for the KŌMA monorepo.
//
// Crosses the USED keys (t("...") calls in apps + shared packages) with the
// DEFINED keys in the catalogs (packages/interface/src/i18n/langs/*.ts).
//
// Usage: node scripts/i18n-key-report.mjs   (prints summary to stderr)
//
// Reading by regex (not AST) — dynamic t(variable) calls are counted
// separately and excluded from the conclusions; false-positive rate stays
// low because the pattern requires \bt( with a literal.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APPS = ["packages/interface"];
const SHELLS = ["apps/electron", "apps/tauri"];
const PKGS = ["apps/electron", "apps/tauri", "packages/auth/src", "packages/ui/src"];
const T_CALL = /\bt\(\s*(['"])((?:[^'"\\]|\\.)*)\1/g;
const T_DYNAMIC = /\bt\(\s*[a-zA-Z_`]/g;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      yield* walk(p);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      yield p;
    }
  }
}

const scanUsage = async (dir) => {
  const used = new Set();
  let dynamic = 0;
  for await (const file of walk(path.join(ROOT, dir))) {
    const src = await readFile(file, "utf8");
    for (const m of src.matchAll(T_CALL)) used.add(m[2]);
    dynamic += (src.match(T_DYNAMIC) ?? []).length;
  }
  return { used, dynamic };
};

const loadCatalogs = async (app) => {
  // Catalogs are FLAT objects (dot-keys, one per line, prettier style) —
  // text extraction avoids importing TS with bundler resolution (no extension).
  const langsDir = path.join(ROOT, app, "src/i18n/langs");
  const catalogs = {};
  const KEY_LINE = /^\s*(?:'([^']+)'|"([^"]+)")\s*:/gm;
  for (const f of await readdir(langsDir)) {
    if (!f.endsWith(".ts") || f === "index.ts" || f === "fallbackKeys.ts") continue;
    const src = await readFile(path.join(langsDir, f), "utf8");
    const keys = new Set();
    for (const m of src.matchAll(KEY_LINE)) keys.add(m[1] ?? m[2]);
    if (keys.size > 0) catalogs[f.replace(".ts", "")] = keys;
  }
  return catalogs;
};

const pct = (n, total) => (total === 0 ? "100%" : `${Math.round((n / total) * 100)}%`);

const main = async () => {
  // Single catalog lives in packages/interface; usage = union of shells + shared packages.
  const { used, dynamic } = await scanUsage("packages/interface/src");
  for (const extra of [...SHELLS, ...PKGS]) {
    const { used: u } = await scanUsage(extra);
    for (const k of u) used.add(k);
  }
  const catalogs = await loadCatalogs("packages/interface");
  const en = catalogs["en"] ?? new Set();

  const missingInEn = new Set([...used].filter((k) => !en.has(k)));
  const dead = new Set([...en].filter((k) => !used.has(k)));

  process.stderr.write(
    `i18n: used=${used.size} (dynamic=${dynamic}) | en.ts=${en.size} | missing-in-en=${missingInEn.size} | dead=${dead.size}\n`,
  );
  if (missingInEn.size) {
    process.stderr.write(
      `missing in en (first 20): ${[...missingInEn].sort().slice(0, 20).join(", ")}\n`,
    );
  }
  if (dead.size) {
    process.stderr.write(
      `dead in en (first 20): ${[...dead].sort().slice(0, 20).join(", ")}\n`,
    );
  }
  for (const [loc, keys] of Object.entries(catalogs).sort()) {
    const missing = [...en].filter((k) => !keys.has(k)).length;
    process.stderr.write(
      `coverage ${loc}: ${keys.size}/${en.size} (${pct(keys.size - missing, en.size)})\n`,
    );
  }
  process.exit(missingInEn.size > 0 ? 1 : 0);
};

main();
