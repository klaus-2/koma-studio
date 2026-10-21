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
    if (acc.length > 5000) throw new Error("scan runaway guard");
  }
  return acc;
};

const readRelative = (relative: string): string =>
  readFileSync(path.join(srcRoot, relative), "utf8");

const pages = (relative: string): string =>
  path.join("pages", relative).split(path.sep).join("/");

/**
 * Stage-label i18n gate — the stage/mode labels are locale-aware (runtime t)
 * and every referenced key exists in both the default (en) and pt-BR
 * catalogs. Also canaries the frozen-label-table exclusions:
 * - the settings AIO_STAGE_LABELS namesake (settings.constants.ts) is a
 *   DIFFERENT symbol and stays untouched;
 * - the AIO_STAGE_BADGE_LABELS table keeps its filename-stable consumers
 *   (export-download.ts uses labels for FILENAME semantics).
 */
describe("stage label i18n coverage", () => {
  const KEY_RE =
    /['"](aio\.singleImage\.[A-Za-z0-9_.]+|dashboard\.aio\.manualStageSkipped|aioModel\.status\.selectAvailableForStage|aio\.stage\.[A-Za-z0-9_.]+|dashboard\.mode\.[A-Za-z0-9_.]+|aio\.pipeline\.render)['"]/g;

  const usedKeys = new Set<string>();
  for (const dir of ["hooks", "pages", "components", "constants"]) {
    for (const file of walkTsFiles(path.join(srcRoot, dir))) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(KEY_RE)) {
        usedKeys.add(match[1]!);
      }
    }
  }

  it("referenced stage/mode label keys exist in the default (en) catalog", () => {
    expect(usedKeys.size).toBeGreaterThan(0);
    const missing = [...usedKeys].filter((key) => !(key in defaultMessages));
    expect(missing).toEqual([]);
  });

  it("referenced stage/mode label keys exist in the pt-BR catalog", () => {
    const missing = [...usedKeys].filter((key) => !(key in ptBrMessages));
    expect(missing).toEqual([]);
  });

  it("keeps the frozen label tables deleted from dashboard.constants.ts", () => {
    const constants = readRelative("constants/dashboard.constants.ts");
    expect(constants).not.toMatch(/AIO_STAGE_LABELS:/);
    expect(constants).not.toMatch(/AIO_PIPELINE_STAGE_LABELS/);
    expect(constants).not.toMatch(/MODE_LABELS:/);
  });

  it("keeps the settings namesake and the badge table untouched", () => {
    const settingsConstants = readRelative("pages/settings/settings.constants.ts");
    expect(settingsConstants).toMatch(/export const AIO_STAGE_LABELS/);

    const dashboardConstants = readRelative("constants/dashboard.constants.ts");
    expect(dashboardConstants).toMatch(/export const AIO_STAGE_BADGE_LABELS/);

    const exportDownload = readRelative("pages/dashboard/hooks/export-download.ts");
    expect(exportDownload).toMatch(/AIO_STAGE_BADGE_LABELS/);
  });

  it("keeps the frozen tables unreferenced across the interface src", () => {
    const forbidden = /AIO_PIPELINE_STAGE_LABELS|(?<![A-Z_])MODE_LABELS(?!_KEYS)|(?<![A-Z_.])AIO_STAGE_LABELS(?!_KEYS|_BADGE)/;
    const offenders: string[] = [];
    for (const dir of ["hooks", "pages", "components", "constants", "stores", "models", "utils"]) {
      const dirPath = path.join(srcRoot, dir);
      let entries: string[] = [];
      try {
        entries = walkTsFiles(dirPath);
      } catch {
        continue;
      }
      for (const file of entries) {
        const text = readFileSync(file, "utf8");
        // The settings AIO_STAGE_LABELS namesake (settings.constants.ts) and
        // its consumers are a different symbol - excluded by plan.
        if (file.split(path.sep).join("/").includes(pages("settings"))) continue;
        if (forbidden.test(text)) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
