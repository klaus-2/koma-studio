import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { defaultMessages } from "@/i18n/messages";
import { ptBrMessages } from "@/i18n/langs/ptBR";

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const walkTsFiles = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkTsFiles(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) {
      acc.push(full);
    }
  }
  return acc;
};

/**
 * Referenced i18n keys must exist in the default (en) catalog. Scoped to
 * aioManual.* keys used by the AIO manual executor and related UI so the gate
 * stays stable.
 */
describe("aioManual i18n key coverage", () => {
  const KEY_RE = /['"](aioManual\.[A-Za-z0-9_.]+)['"]/g;
  const usedKeys = new Set<string>();

  for (const file of walkTsFiles(path.join(srcRoot, "hooks"))) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(KEY_RE)) {
      usedKeys.add(match[1]!);
    }
  }
  for (const file of walkTsFiles(path.join(srcRoot, "pages", "dashboard"))) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(KEY_RE)) {
      usedKeys.add(match[1]!);
    }
  }

  it("finds aioManual.* keys in source", () => {
    expect(usedKeys.size).toBeGreaterThan(0);
  });

  it("every referenced aioManual.* key exists in defaultMessages", () => {
    const missing = [...usedKeys].filter(
      (key) => !(key in defaultMessages),
    );
    expect(missing).toEqual([]);
  });

  it("every referenced aioManual.* key exists in ptBR", () => {
    const missing = [...usedKeys].filter(
      (key) => !(key in ptBrMessages),
    );
    expect(missing).toEqual([]);
  });
});
