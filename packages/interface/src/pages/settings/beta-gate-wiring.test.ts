import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scriptDir = dirname(fileURLToPath(import.meta.url));

const readSource = (relativePath: string): string =>
  readFileSync(resolve(scriptDir, relativePath), "utf8");

describe("beta channel capability gate wiring", () => {
  it("gates the beta button and renders the guidance in the classic tab", () => {
    const source = readSource("./SettingsAppTab.tsx");

    expect(source).toContain("disabled={busy || betaChannelDisabled}");
    expect(source).toContain('t("settings.updates.betaManualOnly")');
  });

  it("scopes the gate to the beta channel and renders the guidance in the noir tab", () => {
    const source = readSource("./noir/SettingsAppTabNoir.tsx");

    expect(source).toContain('ch === "beta" && a.betaChannelDisabled');
    expect(source).toContain('t("settings.updates.betaManualOnly")');
  });

  it("delivers the hook decision to the tab facade from Settings", () => {
    const source = readSource("../Settings.tsx");

    expect(source).toContain("useSettingsUpdaterControls");
    expect(source).toContain("...updaterControls,");
  });
});
