import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_THEME_FAMILY, THEME_FAMILIES, isThemeFamilyId } from "@koma/ui/themes/registry";

// The vitest jsdom env has no storage backend (same as
// useDashboardProcessingStats.test.ts) — Map-backed stub keeps the
// zustand persist rehydration path honest.
const storageMap = new Map<string, string>();
Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string): string | null => storageMap.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      storageMap.set(key, value);
    },
    removeItem: (key: string): void => {
      storageMap.delete(key);
    },
    clear: (): void => {
      storageMap.clear();
    },
  },
});

const matchMediaStub = ((query: string) =>
  ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    onchange: null,
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList) as typeof window.matchMedia;

describe("theme family registry", () => {
  it("exposes classic and noir with i18n keys", () => {
    expect(THEME_FAMILIES.map((f) => f.id)).toEqual(["classic", "noir"]);
    for (const family of THEME_FAMILIES) {
      expect(family.nameKey).toMatch(/^settings\.theme\.family\./);
      expect(family.descKey).toMatch(/^settings\.theme\.family\./);
    }
    expect(DEFAULT_THEME_FAMILY).toBe("noir");
  });

  it("guards family ids", () => {
    expect(isThemeFamilyId("noir")).toBe(true);
    expect(isThemeFamilyId("classic")).toBe(true);
    expect(isThemeFamilyId("solarized")).toBe(false);
    expect(isThemeFamilyId(undefined)).toBe(false);
  });
});

describe("theme store family persistence", () => {
  beforeEach(() => {
    // jsdom has no matchMedia; the store uses it for initial detection only.
    window.matchMedia ??= matchMediaStub;
    storageMap.clear();
    vi.resetModules();
  });

  it("defaults to the noir family for persisted state without family", async () => {
    window.localStorage.setItem(
      "koma_theme",
      JSON.stringify({ state: { theme: "light" }, version: 0 }),
    );

    const { useThemeStore } = await import("@koma/ui/stores/theme-store");

    expect(useThemeStore.getState().theme).toBe("light");
    expect(useThemeStore.getState().family).toBe("noir");
  });

  it("migrates a pre-noir persisted classic family to noir", async () => {
    window.localStorage.setItem(
      "koma_theme",
      JSON.stringify({ state: { theme: "dark", family: "classic" }, version: 0 }),
    );

    const { useThemeStore } = await import("@koma/ui/stores/theme-store");

    expect(useThemeStore.getState().family).toBe("noir");
    expect(window.localStorage.getItem("koma_theme")).toContain('"version":2');
  });

  it("keeps a classic family chosen on the current storage version", async () => {
    window.localStorage.setItem(
      "koma_theme",
      JSON.stringify({ state: { theme: "dark", family: "classic" }, version: 2 }),
    );

    const { useThemeStore } = await import("@koma/ui/stores/theme-store");

    expect(useThemeStore.getState().family).toBe("classic");
  });
});

describe("applyTheme", () => {
  it("applies mode + family attributes and clears the pre-paint background", async () => {
    window.matchMedia ??= matchMediaStub;

    const { applyTheme } = await import("@koma/ui/stores/theme-store");
    const root = document.documentElement;

    root.style.backgroundColor = "#07070c";

    applyTheme("dark");
    expect(root.getAttribute("data-theme")).toBe("dark");
    expect(root.getAttribute("data-theme-family")).toBe("noir");
    expect(root.classList.contains("dark")).toBe(true);
    expect(root.classList.contains("light")).toBe(false);
    expect(root.style.getPropertyValue("background-color")).toBe("");

    applyTheme("light", "classic");
    expect(root.getAttribute("data-theme")).toBe("light");
    expect(root.getAttribute("data-theme-family")).toBe("classic");
    expect(root.classList.contains("light")).toBe(true);
    expect(root.classList.contains("dark")).toBe(false);
  });
});
