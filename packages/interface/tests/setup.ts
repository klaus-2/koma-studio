import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom lacks Blob.prototype.arrayBuffer / File.prototype.arrayBuffer (lib.dom
// declares them; this runtime does not ship them). Code that reads page bytes
// or workspace binaries goes through arrayBuffer(); polyfill both via
// FileReader when the platform does not provide them.
if (typeof Blob.prototype.arrayBuffer !== "function") {
  Blob.prototype.arrayBuffer = function (this: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (): void => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
          return;
        }
        reject(new Error("Failed to read the blob as an ArrayBuffer."));
      };
      reader.onerror = (): void => {
        reject(reader.error ?? new Error("Failed to read the blob."));
      };
      reader.readAsArrayBuffer(this);
    });
  };
}

if (typeof File.prototype.arrayBuffer !== "function") {
  // File extends Blob, so the FileReader-based implementation above is valid
  // for File as well — the signatures are identical.
  File.prototype.arrayBuffer = Blob.prototype.arrayBuffer;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Components render `m` against the app-root LazyMotion provider; tests render
// components without that tree, so map `m` to the full `motion` runtime and
// keep real animation semantics without a provider.
vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return { ...actual, m: actual.motion };
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
