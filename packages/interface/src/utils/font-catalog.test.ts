import { describe, expect, it, vi } from "vitest";

import { APP_WEBFONT_FAMILIES } from "../constants/app-webfonts";
import { DEFAULT_RENDER_FONT_FAMILIES } from "../constants/dashboard.constants";
import type { IDesktopFontEntry } from "@/types";
import {
  buildFontCatalog,
  getFontCatalogFallbackFamilies,
  type FontCatalogSource,
} from "./font-catalog";

type FontsListResult = { system: string[]; custom: IDesktopFontEntry[] };

const bridgeState = vi.hoisted((): {
  listFonts: null | (() => Promise<FontsListResult>);
} => ({ listFonts: null }));

vi.mock("@/lib/desktop-bridge", () => ({
  desktopBridge: {
    get desktop() {
      const listFonts = bridgeState.listFonts;
      if (!listFonts) {
        return null;
      }
      return { api: { fonts: { list: listFonts } } };
    },
  },
}));

const desktopSource = (overrides: Partial<FontCatalogSource> = {}): FontCatalogSource => ({
  osFamilies: [],
  customFamilies: [],
  fallbackFamilies: [],
  ...overrides,
});

const countOf = (catalog: readonly string[], family: string): number =>
  catalog.filter((entry) => entry.toLowerCase() === family.toLowerCase()).length;

describe("buildFontCatalog", () => {
  it("merges the app-loaded webfonts on the desktop path", () => {
    const catalog = buildFontCatalog(desktopSource({ osFamilies: ["Arial"] }));

    for (const family of APP_WEBFONT_FAMILIES) {
      expect(catalog).toContain(family);
    }
  });

  it("merges whatever fallback the caller passes, and nothing when it passes none", () => {
    const withoutProvider = buildFontCatalog(
      desktopSource({ fallbackFamilies: DEFAULT_RENDER_FONT_FAMILIES }),
    );
    const withProvider = buildFontCatalog(desktopSource());

    for (const family of DEFAULT_RENDER_FONT_FAMILIES) {
      expect(withoutProvider).toContain(family);
      expect(withProvider).not.toContain(family);
    }
  });

  it("keeps a family the operating system reports even when it is also a fallback name", () => {
    const catalog = buildFontCatalog(desktopSource({
      osFamilies: ["Times NEW Roman"],
      fallbackFamilies: ["Times New Roman"],
    }));

    expect(countOf(catalog, "Times New Roman")).toBe(1);
    expect(catalog).toContain("Times NEW Roman");
  });

  it("does not widen the list to cover a saved family no source provides", () => {
    const catalog = buildFontCatalog(desktopSource({ osFamilies: ["Arial"] }));

    expect(catalog).not.toContain("Comic Sans MS");
  });

  it("dedupes case-insensitively and keeps the first-seen casing", () => {
    const catalog = buildFontCatalog(desktopSource({ osFamilies: ["arial", "Arial", " ARIAL "] }));

    expect(countOf(catalog, "Arial")).toBe(1);
    expect(catalog).toContain("arial");
  });

  it("dedupes across the webfont, system and custom sources", () => {
    const catalog = buildFontCatalog(
      desktopSource({ osFamilies: ["Cabin", "Zed"], customFamilies: ["Cabin", "Zed"] }),
    );

    expect(countOf(catalog, "Cabin")).toBe(1);
    expect(countOf(catalog, "Zed")).toBe(1);
  });

  it("orders with the pt-BR collator so a shorter family sorts before its own style family", () => {
    const catalog = buildFontCatalog(desktopSource({ osFamilies: ["Arial Black", "Arial"] }));

    expect(catalog.indexOf("Arial")).toBeLessThan(catalog.indexOf("Arial Black"));
  });

  it("orders numeric family suffixes numerically, not lexically", () => {
    const catalog = buildFontCatalog(
      desktopSource({ osFamilies: ["Segoe UI 10", "Segoe UI 2"] }),
    );

    expect(catalog.indexOf("Segoe UI 2")).toBeLessThan(catalog.indexOf("Segoe UI 10"));
  });

  it("orders families the way the pt-BR collator orders them, case and accents aside", () => {
    const inputFamilies = ["yu gothic", "épée nova", "cambria math", "arial"];
    const catalog = buildFontCatalog(
      desktopSource({ osFamilies: ["Yu Gothic", "Épée Nova", "Cambria Math", "arial"] }),
    );
    const orderedInputFamilies = catalog.filter((family) =>
      inputFamilies.includes(family.toLowerCase()),
    );

    expect(orderedInputFamilies).toEqual(["arial", "Cambria Math", "Épée Nova", "Yu Gothic"]);
  });

  it("passes a composite family through untouched and stays '&'-free for '&' names", () => {
    const composite = buildFontCatalog(desktopSource({ osFamilies: ["Cambria & Cambria Math"] }));

    expect(composite).toContain("Cambria & Cambria Math");
    expect(buildFontCatalog(desktopSource({ osFamilies: ["Cambria", "Cambria Math"] })))
      .toEqual(expect.arrayContaining(["Cambria", "Cambria Math"]));
    for (const family of buildFontCatalog(desktopSource({ osFamilies: ["Cambria"] }))) {
      expect(family).not.toContain("&");
    }
  });

  it("tolerates empty and whitespace-only inputs", () => {
    const catalog = buildFontCatalog(
      desktopSource({ osFamilies: ["", "   ", "\t"], customFamilies: [" "] }),
    );

    expect(catalog).toHaveLength(APP_WEBFONT_FAMILIES.length);
    for (const family of catalog) {
      expect(family.trim()).toBe(family);
      expect(family.length).toBeGreaterThan(0);
    }
  });

  it("keeps a vertical-text family exactly as the operating system reports it", () => {
    const catalog = buildFontCatalog(desktopSource({ osFamilies: ["@MS Gothic", "@SimSun"] }));

    expect(catalog).toContain("@MS Gothic");
    expect(catalog).toContain("@SimSun");
  });

  it("merges custom imported families alongside the system ones", () => {
    const catalog = buildFontCatalog(
      desktopSource({ osFamilies: ["Arial"], customFamilies: ["Minha Fonte"] }),
    );

    expect(catalog).toContain("Minha Fonte");
    expect(catalog).toContain("Arial");
  });
});

describe("getFontCatalogFallbackFamilies", () => {
  it("hands the fallback families only to a runtime with no desktop provider", () => {
    bridgeState.listFonts = null;
    expect(getFontCatalogFallbackFamilies()).toEqual(DEFAULT_RENDER_FONT_FAMILIES);

    bridgeState.listFonts = async () => ({ system: [], custom: [] });
    expect(getFontCatalogFallbackFamilies()).toEqual([]);

    bridgeState.listFonts = null;
  });
});
