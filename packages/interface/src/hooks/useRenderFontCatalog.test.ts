import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { APP_WEBFONT_FAMILIES } from "@/constants/app-webfonts";
import { DEFAULT_RENDER_STYLE } from "@/constants/dashboard.constants";
import { getFontCatalogSnapshot } from "@/lib/font-catalog-cache";
import type { IDesktopFontEntry } from "@/types";
import {
  ensureCanvasFontLoaded,
  resetLoadedCanvasFontCache,
} from "@/utils/dashboard.utils";
import type { RenderTextStyle } from "@/utils/renderText";
import { useRenderFontCatalog } from "./useRenderFontCatalog";

vi.mock("@/utils/dashboard.utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/dashboard.utils")>();
  return {
    ...actual,
    resetLoadedCanvasFontCache: vi.fn(actual.resetLoadedCanvasFontCache),
  };
});

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

const INVALID_FONT_FAMILY = "Koma Broken Font";

class StubFontFace implements FontFace {
  ascentOverride = "normal";
  descentOverride = "normal";
  display: FontDisplay = "auto";
  family: string;
  featureSettings = "normal";
  lineGapOverride = "normal";
  readonly loaded = new Promise<FontFace>(() => {});
  readonly status: FontFaceLoadStatus = "unloaded";
  stretch = "normal";
  style = "normal";
  unicodeRange = "U+0-10FFFF";
  weight = "normal";
  readonly source: string;

  constructor(family: string, source: string) {
    if (family === INVALID_FONT_FAMILY) {
      throw new Error("invalid font face data");
    }
    this.family = family;
    this.source = source;
  }

  load(): Promise<FontFace> {
    return Promise.resolve(this);
  }
}

interface StubFontSet {
  added: FontFace[];
  deleted: FontFace[];
  requests: string[];
  available: boolean;
  check: (request: string) => boolean;
  load: (request: string) => Promise<FontFace[]>;
  add: (face: FontFace) => void;
  delete: (face: FontFace) => boolean;
}

const createStubFontSet = (): StubFontSet => {
  const fontSet: StubFontSet = {
    added: [],
    deleted: [],
    requests: [],
    available: false,
    check: (): boolean => fontSet.available,
    load: (request: string): Promise<FontFace[]> => {
      fontSet.requests.push(request);
      fontSet.available = true;
      return Promise.resolve([...fontSet.added]);
    },
    add: (face: FontFace): void => {
      fontSet.added.push(face);
    },
    delete: (face: FontFace): boolean => {
      const registeredIndex = fontSet.added.indexOf(face);
      fontSet.deleted.push(face);
      if (registeredIndex < 0) {
        return false;
      }
      fontSet.added.splice(registeredIndex, 1);
      return true;
    },
  };
  return fontSet;
};

const buildFontEntry = (id: string, family: string, dataUrl: string): IDesktopFontEntry => ({
  id,
  family,
  fileName: `${family}.ttf`,
  dataUrl,
});

const stubBrowserFontEnvironment = (): StubFontSet => {
  vi.stubGlobal("FontFace", StubFontFace);
  const fontSet = createStubFontSet();
  Object.defineProperty(document, "fonts", {
    value: fontSet,
    configurable: true,
  });
  return fontSet;
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(document, "fonts");
});

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
  });
});

describe("useRenderFontCatalog custom FontFace lazy registration", () => {
  beforeEach(() => {
    bridgeState.listFonts = null;
    resetLoadedCanvasFontCache();
  });

  it("registers every custom family via document.fonts.add without loading the faces", async () => {
    const fontSet = stubBrowserFontEnvironment();
    const faceLoadSpy = vi.spyOn(StubFontFace.prototype, "load");
    bridgeState.listFonts = async () => ({
      system: ["Arial"],
      custom: [
        buildFontEntry("custom-1", "Custom One", "data:font/ttf;base64,Q3VzdG9t"),
        buildFontEntry("custom-2", "Custom Two", "data:font/ttf;base64,Q3VzdG9tMg=="),
      ],
    });

    const { result } = renderCatalogHook();
    await waitFor(() => {
      expect(result.current.availableRenderFonts).toContain("Custom One");
      expect(result.current.availableRenderFonts).toContain("Custom Two");
    });

    expect(result.current.availableRenderFonts).toContain("Arial");
    expect(fontSet.added.map((face) => face.family)).toEqual(["Custom One", "Custom Two"]);
    expect(faceLoadSpy).not.toHaveBeenCalled();
    expect(fontSet.requests).toEqual([]);
  });

  it("loads a registered-unloaded custom face on first render use via ensureCanvasFontLoaded", async () => {
    const fontSet = stubBrowserFontEnvironment();
    bridgeState.listFonts = async () => ({
      system: ["Arial"],
      custom: [buildFontEntry("custom-1", "Lazy Custom", "data:font/ttf;base64,TGF6eQ==")],
    });

    renderCatalogHook();
    await waitFor(() => {
      expect(fontSet.added).toHaveLength(1);
    });

    const style: RenderTextStyle = { ...DEFAULT_RENDER_STYLE, fontFamily: "Lazy Custom" };
    await expect(ensureCanvasFontLoaded(style, undefined, fontSet)).resolves.toBe(true);
    expect(fontSet.requests).toEqual(['400 16px "Lazy Custom"']);

    await expect(ensureCanvasFontLoaded(style, undefined, fontSet)).resolves.toBe(false);
  });

  it("skips re-registration for unchanged entries on catalog reload and re-keys the font cache", async () => {
    const fontSet = stubBrowserFontEnvironment();
    bridgeState.listFonts = async () => ({
      system: ["Arial"],
      custom: [buildFontEntry("custom-1", "Custom One", "data:font/ttf;base64,Q3VzdG9t")],
    });

    const { result } = renderCatalogHook();
    await waitFor(() => {
      expect(fontSet.added).toHaveLength(1);
    });
    const registeredFace = fontSet.added[0];
    expect(registeredFace).toBeDefined();

    const style: RenderTextStyle = { ...DEFAULT_RENDER_STYLE, fontFamily: "Custom One" };
    fontSet.available = true;
    await expect(ensureCanvasFontLoaded(style, undefined, fontSet)).resolves.toBe(true);

    vi.mocked(resetLoadedCanvasFontCache).mockClear();

    await act(async () => {
      await result.current.loadRenderFontCatalog();
    });

    expect(fontSet.added).toHaveLength(1);
    expect(fontSet.added[0]).toBe(registeredFace);
    expect(fontSet.deleted).toEqual([]);
    expect(resetLoadedCanvasFontCache).toHaveBeenCalledTimes(1);
    await expect(ensureCanvasFontLoaded(style, undefined, fontSet)).resolves.toBe(true);
  });

  it("deletes faces for entries removed or replaced on catalog reload", async () => {
    const fontSet = stubBrowserFontEnvironment();
    const faceLoadSpy = vi.spyOn(StubFontFace.prototype, "load");
    bridgeState.listFonts = async () => ({
      system: ["Arial"],
      custom: [
        buildFontEntry("custom-1", "Custom One", "data:font/ttf;base64,Q3VzdG9t"),
        buildFontEntry("custom-2", "Custom Two", "data:font/ttf;base64,Q3VzdG9tMg=="),
      ],
    });

    const { result } = renderCatalogHook();
    await waitFor(() => {
      expect(fontSet.added).toHaveLength(2);
    });
    const faceOne = fontSet.added[0];
    const faceTwo = fontSet.added[1];
    expect(faceOne).toBeDefined();
    expect(faceTwo).toBeDefined();

    bridgeState.listFonts = async () => ({
      system: ["Arial"],
      custom: [buildFontEntry("custom-2", "Custom Two", "data:font/ttf;base64,Q3VzdG9tMg==")],
    });
    await act(async () => {
      await result.current.loadRenderFontCatalog();
    });

    expect(fontSet.deleted).toHaveLength(1);
    expect(fontSet.deleted[0]).toBe(faceOne);
    expect(fontSet.added).toHaveLength(1);
    expect(fontSet.added[0]).toBe(faceTwo);

    bridgeState.listFonts = async () => ({
      system: ["Arial"],
      custom: [buildFontEntry("custom-2", "Custom Two Renamed", "data:font/ttf;base64,Q3VzdG9tMg==")],
    });
    await act(async () => {
      await result.current.loadRenderFontCatalog();
    });

    expect(fontSet.deleted).toHaveLength(2);
    expect(fontSet.deleted[1]).toBe(faceTwo);
    expect(fontSet.added).toHaveLength(1);
    expect(fontSet.added[0]?.family).toBe("Custom Two Renamed");
    expect(faceLoadSpy).not.toHaveBeenCalled();
  });

  it("skips a custom entry whose FontFace construction throws without breaking the catalog", async () => {
    const fontSet = stubBrowserFontEnvironment();
    bridgeState.listFonts = async () => ({
      system: ["Arial"],
      custom: [
        buildFontEntry("custom-1", "Custom One", "data:font/ttf;base64,Q3VzdG9t"),
        buildFontEntry("broken", INVALID_FONT_FAMILY, "data:font/ttf;base64,QnJva2Vu"),
        buildFontEntry("custom-2", "Custom Two", "data:font/ttf;base64,Q3VzdG9tMg=="),
      ],
    });

    const { result } = renderCatalogHook();
    await waitFor(() => {
      expect(result.current.availableRenderFonts).toContain("Custom One");
      expect(result.current.availableRenderFonts).toContain("Custom Two");
    });

    expect(fontSet.added.map((face) => face.family)).toEqual(["Custom One", "Custom Two"]);
    expect(result.current.availableRenderFonts).toContain(INVALID_FONT_FAMILY);
    expect(result.current.fontCatalogError).toBeNull();
  });

  it("deletes tracked custom faces when the desktop font provider disappears", async () => {
    const fontSet = stubBrowserFontEnvironment();
    bridgeState.listFonts = async () => ({
      system: ["Arial"],
      custom: [buildFontEntry("custom-1", "Custom One", "data:font/ttf;base64,Q3VzdG9t")],
    });

    const { result } = renderCatalogHook();
    await waitFor(() => {
      expect(fontSet.added).toHaveLength(1);
    });
    const registeredFace = fontSet.added[0];
    expect(registeredFace).toBeDefined();

    bridgeState.listFonts = null;
    await act(async () => {
      await result.current.loadRenderFontCatalog();
    });

    expect(fontSet.deleted).toHaveLength(1);
    expect(fontSet.deleted[0]).toBe(registeredFace);
    expect(fontSet.added).toHaveLength(0);

    await waitFor(() => {
      expect(result.current.availableRenderFonts).toContain("CC Wild Words");
    });
  });
});
