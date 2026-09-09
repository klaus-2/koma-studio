#!/usr/bin/env node
// Updates the `fileSize` field of each model in the registries with the REAL
// download size (X-Linked-Size from the HF resolve; falls back to
// Content-Length).
//
// Usage: node scripts/update-model-sizes.mjs [--check]
//   --check: only reports divergences, does not write (exit 1 if any).
//
// Uses regex over the registries (flat objects, one field per line) — the same
// pattern as i18n-key-report; if the registries become AST-structured, switch
// to an import via tsx.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECK_ONLY = process.argv.includes("--check");
const REGISTRIES = [
  "packages/interface/src/models/translation-text-model-registry-data.ts",
  "packages/interface/src/models/translation-image-model-registry-data.ts",
];
const ENTRY_WINDOW = 800; // downloadUrl → fileSize within the same object
const FETCH_TIMEOUT_MS = 30_000;

const humanSize = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) {
    const gb = mb / 1024;
    return `${Number(gb.toFixed(2))}GB`;
  }
  return `${Number(mb.toFixed(2))}MB`;
};

const fetchSize = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { method: "HEAD", signal: controller.signal });
    if (!response.ok && response.status !== 302) {
      return { error: `HTTP ${response.status}` };
    }
    const linked = response.headers.get("x-linked-size");
    const content = response.headers.get("content-length");
    const bytes = Number(linked ?? content);
    if (!Number.isFinite(bytes) || bytes <= 0) return { error: "no size in HEAD" };
    return { bytes };
  } catch (error) {
    return { error: String(error) };
  } finally {
    clearTimeout(timer);
  }
};

const main = async () => {
  let changes = 0;
  let failures = 0;

  for (const rel of REGISTRIES) {
    const file = path.join(ROOT, rel);
    const src = await readFile(file, "utf8");
    let updated = src;

    for (const m of src.matchAll(/downloadUrl:\s*"(https?:\/\/[^"]+)"/g)) {
      const tailStart = m.index + m[0].length;
      const tail = src.slice(tailStart, tailStart + ENTRY_WINDOW);
      const sizeMatch = tail.match(/fileSize:\s*"([^"]+)"/);
      if (!sizeMatch) continue;

      const { bytes, error } = await fetchSize(m[1]);
      const modelId = src.slice(Math.max(0, m.index - 600), m.index).match(/id:\s*"([^"]+)"/)?.[1] ?? "?";
      if (error) {
        failures += 1;
        console.log(`FAIL   ${modelId}: ${error}`);
        continue;
      }

      const real = humanSize(bytes);
      // Plausibility guard: several URLs point to ONE file from a multi-file
      // payload (e.g. a 57KB config/index inside an 18GB model). Only update
      // when the HEAD actually represents the declared payload.
      const oldNum = parseFloat(sizeMatch[1]);
      const oldBytes = oldNum * (sizeMatch[1].includes("GB") ? 1024 ** 3 : 1024 ** 2);
      const ratio = bytes / oldBytes;
      if (real && real !== sizeMatch[1] && ratio >= 0.34 && ratio <= 3) {
        console.log(`CHANGE  ${modelId}: ${sizeMatch[1]} → ${real} (${bytes} bytes)`);
        if (!CHECK_ONLY) {
          // Absolute-position replacement (never re-splice by window: a length
          // delta would corrupt the following text).
          const target = `fileSize: "${sizeMatch[1]}"`;
          const abs = updated.indexOf(target, tailStart);
          if (abs !== -1 && abs < tailStart + ENTRY_WINDOW) {
            updated = updated.slice(0, abs) + `fileSize: "${real}"` + updated.slice(abs + target.length);
          }
        }
        changes += 1;
      } else if (real && real !== sizeMatch[1]) {
        console.log(`SKIP    ${modelId}: HEAD ${humanSize(bytes)} ≠ declared ${sizeMatch[1]} (multi-file payload?)`);
      } else {
        console.log(`ok      ${modelId}: ${sizeMatch[1]}`);
      }
    }

    if (!CHECK_ONLY && updated !== src) {
      await writeFile(file, updated, "utf8");
    }
  }

  console.log(`\n${changes} divergence(s), ${failures} network failure(s)${CHECK_ONLY ? " (--check mode)" : ""}`);
  if (CHECK_ONLY && changes > 0) process.exitCode = 1;
};

await main();
