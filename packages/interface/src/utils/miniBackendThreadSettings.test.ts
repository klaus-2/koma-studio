import { beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_MINI_BACKEND_THREAD_SETTINGS,
  MINI_BACKEND_THREAD_SETTINGS_STORAGE_KEY,
  loadMiniBackendThreadSettings,
  sanitizeMiniBackendThreadSettings,
  saveMiniBackendThreadSettings,
} from "./miniBackendThreadSettings";

describe("miniBackendThreadSettings", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe("sanitizeMiniBackendThreadSettings", () => {
    it("returns defaults for null and non-object payloads", () => {
      expect(sanitizeMiniBackendThreadSettings(null)).toEqual(
        DEFAULT_MINI_BACKEND_THREAD_SETTINGS,
      );
      expect(sanitizeMiniBackendThreadSettings(undefined)).toEqual(
        DEFAULT_MINI_BACKEND_THREAD_SETTINGS,
      );
      expect(sanitizeMiniBackendThreadSettings("4")).toEqual(
        DEFAULT_MINI_BACKEND_THREAD_SETTINGS,
      );
      expect(sanitizeMiniBackendThreadSettings([4])).toEqual(
        DEFAULT_MINI_BACKEND_THREAD_SETTINGS,
      );
      expect(sanitizeMiniBackendThreadSettings({})).toEqual(
        DEFAULT_MINI_BACKEND_THREAD_SETTINGS,
      );
    });

    it("keeps explicit null as the default sentinel", () => {
      expect(sanitizeMiniBackendThreadSettings({ intraOpThreads: null })).toEqual({
        intraOpThreads: null,
        engineIdleTimeoutSeconds: 600,
        workingResolutionMegapixels: 24,
        workingResolutionOcrClean: false,
      });
    });

    it("keeps finite positive integers", () => {
      expect(sanitizeMiniBackendThreadSettings({ intraOpThreads: 4 })).toEqual({
        intraOpThreads: 4,
        engineIdleTimeoutSeconds: 600,
        workingResolutionMegapixels: 24,
        workingResolutionOcrClean: false,
      });
    });

    it("rounds fractional values", () => {
      expect(sanitizeMiniBackendThreadSettings({ intraOpThreads: 4.6 })).toEqual({
        intraOpThreads: 5,
        engineIdleTimeoutSeconds: 600,
        workingResolutionMegapixels: 24,
        workingResolutionOcrClean: false,
      });
    });

    it("clamps above the 64-thread ceiling", () => {
      expect(sanitizeMiniBackendThreadSettings({ intraOpThreads: 500 })).toEqual({
        intraOpThreads: 64,
        engineIdleTimeoutSeconds: 600,
        workingResolutionMegapixels: 24,
        workingResolutionOcrClean: false,
      });
    });

    it("maps unusable values to null", () => {
      expect(sanitizeMiniBackendThreadSettings({ intraOpThreads: 0 })).toEqual({
        intraOpThreads: null,
        engineIdleTimeoutSeconds: 600,
        workingResolutionMegapixels: 24,
        workingResolutionOcrClean: false,
      });
      expect(sanitizeMiniBackendThreadSettings({ intraOpThreads: -3 })).toEqual({
        intraOpThreads: null,
        engineIdleTimeoutSeconds: 600,
        workingResolutionMegapixels: 24,
        workingResolutionOcrClean: false,
      });
      expect(
        sanitizeMiniBackendThreadSettings({ intraOpThreads: "many" }),
      ).toEqual(DEFAULT_MINI_BACKEND_THREAD_SETTINGS);
      expect(
        sanitizeMiniBackendThreadSettings({ intraOpThreads: Number.NaN }),
      ).toEqual(DEFAULT_MINI_BACKEND_THREAD_SETTINGS);
    });

    it("fills the runtime tunables with defaults for old stored shapes", () => {
      expect(sanitizeMiniBackendThreadSettings({ intraOpThreads: 6 })).toEqual({
        intraOpThreads: 6,
        engineIdleTimeoutSeconds: 600,
        workingResolutionMegapixels: 24,
        workingResolutionOcrClean: false,
      });
    });

    it("clamps the engine idle timeout into 0..86400", () => {
      const sanitizeWith = (engineIdleTimeoutSeconds: unknown) =>
        sanitizeMiniBackendThreadSettings({
          intraOpThreads: 4,
          engineIdleTimeoutSeconds,
        }).engineIdleTimeoutSeconds;

      expect(sanitizeWith(undefined)).toBe(600);
      expect(sanitizeWith(0)).toBe(0);
      expect(sanitizeWith(600)).toBe(600);
      expect(sanitizeWith(86400)).toBe(86400);
      expect(sanitizeWith(999999)).toBe(86400);
      expect(sanitizeWith(-5)).toBe(0);
      expect(sanitizeWith(300.6)).toBe(301);
      expect(sanitizeWith("many")).toBe(600);
    });

    it("clamps the working resolution into 4..64", () => {
      const sanitizeWith = (workingResolutionMegapixels: unknown) =>
        sanitizeMiniBackendThreadSettings({
          intraOpThreads: 4,
          workingResolutionMegapixels,
        }).workingResolutionMegapixels;

      expect(sanitizeWith(undefined)).toBe(24);
      expect(sanitizeWith(2)).toBe(4);
      expect(sanitizeWith(24)).toBe(24);
      expect(sanitizeWith(64)).toBe(64);
      expect(sanitizeWith(100)).toBe(64);
      expect(sanitizeWith("many")).toBe(24);
    });

    it("keeps only real booleans for the OCR/clean policy", () => {
      const sanitizeWith = (workingResolutionOcrClean: unknown) =>
        sanitizeMiniBackendThreadSettings({
          intraOpThreads: 4,
          workingResolutionOcrClean,
        }).workingResolutionOcrClean;

      expect(sanitizeWith(undefined)).toBe(false);
      expect(sanitizeWith(true)).toBe(true);
      expect(sanitizeWith(false)).toBe(false);
      expect(sanitizeWith("yes")).toBe(false);
    });
  });

  describe("load/save round-trip", () => {
    it("returns defaults when nothing is stored", () => {
      expect(loadMiniBackendThreadSettings()).toEqual(
        DEFAULT_MINI_BACKEND_THREAD_SETTINGS,
      );
    });

    it("persists and reloads a sanitized value", () => {
      saveMiniBackendThreadSettings({
        intraOpThreads: 8,
        engineIdleTimeoutSeconds: 300,
        workingResolutionMegapixels: 32,
        workingResolutionOcrClean: true,
      });
      expect(
        window.localStorage.getItem(MINI_BACKEND_THREAD_SETTINGS_STORAGE_KEY),
      ).toBe(
        JSON.stringify({
          intraOpThreads: 8,
          engineIdleTimeoutSeconds: 300,
          workingResolutionMegapixels: 32,
          workingResolutionOcrClean: true,
        }),
      );
      expect(loadMiniBackendThreadSettings()).toEqual({
        intraOpThreads: 8,
        engineIdleTimeoutSeconds: 300,
        workingResolutionMegapixels: 32,
        workingResolutionOcrClean: true,
      });
    });

    it("sanitizes stored garbage into defaults", () => {
      window.localStorage.setItem(
        MINI_BACKEND_THREAD_SETTINGS_STORAGE_KEY,
        "not-json",
      );
      expect(loadMiniBackendThreadSettings()).toEqual(
        DEFAULT_MINI_BACKEND_THREAD_SETTINGS,
      );
      window.localStorage.setItem(
        MINI_BACKEND_THREAD_SETTINGS_STORAGE_KEY,
        JSON.stringify({ intraOpThreads: "bogus" }),
      );
      expect(loadMiniBackendThreadSettings()).toEqual(
        DEFAULT_MINI_BACKEND_THREAD_SETTINGS,
      );
    });
  });
});
