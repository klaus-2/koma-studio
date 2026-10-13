import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { APP_WEBFONT_FAMILIES } from "@/constants/app-webfonts";
import { getFontCatalogSnapshot } from "@/lib/font-catalog-cache";
import type { IDesktopFontEntry } from "@/types";
import { useRenderFontCatalog } from "./useRenderFontCatalog";

type FontsListResult = { system: string[]; custom: IDesktopFontEntry[] };

const bridgeState = vi.hoisted((): {
  listFonts: null | (() => Promise<FontsListResult>);
} => ({ listFonts: null }));

vi.mock("@/i18n", () => ({
  useI18n: () => ({ t: (key: string): string => key }),
}));

vi.mock("@/lib/desktop-bridge", () => ({
  desktopBridge: {
    isDesktopRuntime: () => bridgeState.listFonts !== null,
    getRuntimeConfig: () => ({}),
    get desktop() {
      const listFonts = bridgeState.listFonts;
      if (!listFonts) {
        return null;
      }
      return { api: { fonts: { list: listFonts } } };
    },
  },
}));

const renderCatalogHook = () =>
  renderHook(() => useRenderFontCatalog({ onImportSuccess: () => {} }));

describe("useRenderFontCatalog", () => {
  beforeEach(() => {
    bridgeState.listFonts = null;
  });

  it("lists the system families plus the app-loaded webfonts when a desktop provider answers", async () => {
    bridgeState.listFonts = async () => ({ system: ["Arial"], custom: [] });

    const { result } = renderCatalogHook();
    await waitFor(() => {
      expect(result.current.availableRenderFonts).toContain("Arial");
    });

    for (const family of APP_WEBFONT_FAMILIES) {
      expect(result.current.availableRenderFonts).toContain(family);
    }
  });

  it("stops seeding the never-installed comic families once a desktop provider answers", async () => {
    bridgeState.listFonts = async () => ({ system: ["Arial"], custom: [] });

    const { result } = renderCatalogHook();
    await waitFor(() => {
      expect(result.current.availableRenderFonts).toContain("Arial");
    });

    expect(result.current.availableRenderFonts).not.toContain("CC Wild Words");
    expect(result.current.availableRenderFonts).not.toContain("Anime Ace");
    expect(result.current.availableRenderFonts).not.toContain("Manga Temple");
    expect(result.current.availableRenderFonts).not.toContain("Back Issues");
  });

  it("does not widen the catalog around a saved family no source reports", async () => {
    bridgeState.listFonts = async () => ({ system: ["Arial"], custom: [] });

    const { result } = renderCatalogHook();
    await waitFor(() => {
      expect(result.current.availableRenderFonts).toContain("Archivo");
    });

    expect(result.current.availableRenderFonts).not.toContain("Comic Sans MS");
  });

  it("degrades to the fallback families plus the webfonts when there is no desktop provider", async () => {
    bridgeState.listFonts = null;

    const { result } = renderCatalogHook();
    await waitFor(() => {
      expect(result.current.availableRenderFonts).toContain("CC Wild Words");
    });

    for (const family of APP_WEBFONT_FAMILIES) {
      expect(result.current.availableRenderFonts).toContain(family);
    }
  });

  it("keeps one array reference across a rerender with unchanged inputs", async () => {
    bridgeState.listFonts = async () => ({ system: ["Arial"], custom: [] });

    const { result, rerender } = renderCatalogHook();
    await waitFor(() => {
      expect(result.current.availableRenderFonts).toContain("Arial");
    });

    const catalogAfterLoad = result.current.availableRenderFonts;
    rerender();
    expect(result.current.availableRenderFonts).toBe(catalogAfterLoad);
    rerender();
    expect(result.current.availableRenderFonts).toBe(catalogAfterLoad);
  });

  it("publishes the loaded catalog to the cache and keeps that reference across a reload", async () => {
    bridgeState.listFonts = async () => ({ system: ["Arial"], custom: [] });

    const { result } = renderCatalogHook();
    await waitFor(() => {
      expect(result.current.availableRenderFonts).toContain("Arial");
    });

    const snapshotAfterLoad = getFontCatalogSnapshot();
    expect(snapshotAfterLoad).toEqual(result.current.availableRenderFonts);

    await act(async () => {
      await result.current.loadRenderFontCatalog();
    });

    expect(getFontCatalogSnapshot()).toBe(snapshotAfterLoad);
  });});
