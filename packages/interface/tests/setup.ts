import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock @tauri-apps/api/core invoke globally; tests can override per case.
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => undefined),
  isTauri: vi.fn(() => false),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => undefined),
  emit: vi.fn(async () => undefined),
}));

// jsdom has no matchMedia; @koma/ui's theme store reads the colour scheme at module evaluation.
if (typeof window !== "undefined") {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// jsdom has no localStorage; ui-shell-store reads the keyboard shortcut config when the store is created.
if (typeof window !== "undefined" && !window.localStorage) {
  const backing = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string): string | null =>
        backing.has(key) ? (backing.get(key) as string) : null,
      setItem: (key: string, value: string): void => {
        backing.set(key, String(value));
      },
      removeItem: (key: string): void => {
        backing.delete(key);
      },
      clear: (): void => {
        backing.clear();
      },
      key: (index: number): string | null =>
        Array.from(backing.keys())[index] ?? null,
      get length(): number {
        return backing.size;
      },
    },
  });
}
