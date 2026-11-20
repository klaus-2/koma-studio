import { beforeEach, describe, expect, it, vi } from "vitest";

const namingStorageKey = "koma-studio.export-naming.v1";

/** Fresh store instance per test: the module reads localStorage once at
 *  creation (works-store pattern), so persistence tests reset modules. */
const importFreshStore = async () => {
  vi.resetModules();
  const mod = await import("./export-store");
  return mod.useExportStore;
};

describe("export-store naming persistence (I2)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.resetModules();
  });

  it("mirrors the naming pattern and recents to localStorage on change", async () => {
    const store = await importFreshStore();
    store.getState().setNamingPattern("{obra}/{pagina}");
    store.getState().addRecentNamingPattern("{obra}/{pagina}");
    expect(JSON.parse(window.localStorage.getItem(namingStorageKey) ?? "{}")).toEqual({
      namingPattern: "{obra}/{pagina}",
      recentNamingPatterns: ["{obra}/{pagina}"],
    });
  });

  it("loads the persisted naming on init", async () => {
    window.localStorage.setItem(
      namingStorageKey,
      JSON.stringify({
        namingPattern: "{capitulo}-{pagina}",
        recentNamingPatterns: ["{capitulo}-{pagina}", "{obra}"],
      }),
    );
    const store = await importFreshStore();
    expect(store.getState().namingPattern).toBe("{capitulo}-{pagina}");
    expect(store.getState().recentNamingPatterns).toEqual([
      "{capitulo}-{pagina}",
      "{obra}",
    ]);
  });

  it("falls back to empty defaults on a corrupt payload", async () => {
    window.localStorage.setItem(namingStorageKey, "{not-json");
    const store = await importFreshStore();
    expect(store.getState().namingPattern).toBe("");
    expect(store.getState().recentNamingPatterns).toEqual([]);
  });

  it("falls back to empty defaults on a non-record payload", async () => {
    window.localStorage.setItem(namingStorageKey, JSON.stringify([1, 2]));
    const store = await importFreshStore();
    expect(store.getState().namingPattern).toBe("");
    expect(store.getState().recentNamingPatterns).toEqual([]);
  });

  it("drops non-string and blank entries from persisted recents", async () => {
    window.localStorage.setItem(
      namingStorageKey,
      JSON.stringify({
        namingPattern: "{pagina}",
        recentNamingPatterns: ["{pagina}", 42, "   ", "{obra}"],
      }),
    );
    const store = await importFreshStore();
    expect(store.getState().recentNamingPatterns).toEqual(["{pagina}", "{obra}"]);
  });

  it("caps recents at five, dedups, and keeps most-recent-first", async () => {
    const store = await importFreshStore();
    for (const pattern of ["a", "b", "c", "d", "e", "f"]) {
      store.getState().addRecentNamingPattern(pattern);
    }
    store.getState().addRecentNamingPattern("c");
    expect(store.getState().recentNamingPatterns).toEqual([
      "c",
      "f",
      "e",
      "d",
      "b",
    ]);
    store.getState().addRecentNamingPattern("   ");
    expect(store.getState().recentNamingPatterns).toHaveLength(5);
  });

  it("never persists an empty naming pattern over the record", async () => {
    window.localStorage.setItem(
      namingStorageKey,
      JSON.stringify({ namingPattern: "{obra}", recentNamingPatterns: ["{obra}"] }),
    );
    const store = await importFreshStore();
    store.getState().setNamingPattern("");
    expect(JSON.parse(window.localStorage.getItem(namingStorageKey) ?? "{}")).toEqual({
      namingPattern: "",
      recentNamingPatterns: ["{obra}"],
    });
  });
});
