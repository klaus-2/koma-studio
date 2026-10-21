import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { defaultMessages } from "@/i18n/messages";
import type { TranslationCatalog } from "@/i18n/messages";
import { arMessages } from "@/i18n/langs/ar";
import { deMessages } from "@/i18n/langs/de";
import { enMessages } from "@/i18n/langs/en";
import { esMessages } from "@/i18n/langs/es";
import { frMessages } from "@/i18n/langs/fr";
import { hiMessages } from "@/i18n/langs/hi";
import { itMessages } from "@/i18n/langs/it";
import { jaMessages } from "@/i18n/langs/ja";
import { koMessages } from "@/i18n/langs/ko";
import { ptMessages } from "@/i18n/langs/pt";
import { ptBrMessages } from "@/i18n/langs/ptBR";
import { ruMessages } from "@/i18n/langs/ru";
import { zhMessages as zhCnMessages } from "@/i18n/langs/zh";
import { zhMessages as zhTwMessages } from "@/i18n/langs/zhTW";

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspacePackages = path.resolve(srcRoot, "..", "..");

const localeCatalogs: Record<string, TranslationCatalog> = {
  ar: arMessages,
  de: deMessages,
  en: enMessages,
  es: esMessages,
  fr: frMessages,
  hi: hiMessages,
  it: itMessages,
  ja: jaMessages,
  ko: koMessages,
  pt: ptMessages,
  "pt-br": ptBrMessages,
  ru: ruMessages,
  zh: zhCnMessages,
  "zh-tw": zhTwMessages,
};

/** Namespaces that must not leak a raw key in any locale. */
const guardedPrefixes = [
  "freeProviderCard.",
  "modelManager.filters.",
  "dashboard.translator.",
] as const;

const walkTsFiles = (dir: string, acc: string[] = []): string[] => {
  if (!statSync(dir).isDirectory()) return acc;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      walkTsFiles(full, acc);
    } else if (
      /\.(ts|tsx)$/.test(entry) &&
      !entry.endsWith(".test.ts") &&
      !entry.endsWith(".test.tsx")
    ) {
      acc.push(full);
    }
  }
  return acc;
};

const CALL_RE = /\bt\(\s*['"]([A-Za-z0-9_.]+)['"]/g;

const usedKeys = ((): Set<string> => {
  const keys = new Set<string>();
  const roots = [
    srcRoot,
    path.join(workspacePackages, "ui", "src"),
    path.join(workspacePackages, "auth", "src"),
  ];
  for (const root of roots) {
    for (const file of walkTsFiles(root)) {
      if (file.includes(`${path.sep}i18n${path.sep}langs${path.sep}`)) continue;
      for (const match of readFileSync(file, "utf8").matchAll(CALL_RE)) {
        const key = match[1];
        if (key !== undefined) {
          keys.add(key);
        }
      }
    }
  }
  return keys;
})();

describe("i18n key coverage", () => {
  it("finds statically referenced translation keys", () => {
    expect(usedKeys.size).toBeGreaterThan(1000);
  });

  it("resolves every statically referenced key in the default catalog", () => {
    const missing = [...usedKeys].filter((key) => !(key in defaultMessages));
    expect(missing).toEqual([]);
  });

  it("resolves the guarded namespaces in every locale", () => {
    const guarded = [...usedKeys].filter((key) =>
      guardedPrefixes.some((prefix) => key.startsWith(prefix)),
    );
    expect(guarded.length).toBeGreaterThan(0);

    for (const [locale, catalog] of Object.entries(localeCatalogs)) {
      const missing = guarded.filter((key) => !(key in catalog));
      expect({ locale, missing }).toEqual({ locale, missing: [] });
    }
  });
});
