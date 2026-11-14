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
      });
    });

    it("keeps finite positive integers", () => {
      expect(sanitizeMiniBackendThreadSettings({ intraOpThreads: 4 })).toEqual({
        intraOpThreads: 4,
      });
    });

    it("rounds fractional values", () => {
      expect(sanitizeMiniBackendThreadSettings({ intraOpThreads: 4.6 })).toEqual({
        intraOpThreads: 5,
      });
    });

    it("clamps above the 64-thread ceiling", () => {
      expect(sanitizeMiniBackendThreadSettings({ intraOpThreads: 500 })).toEqual({
        intraOpThreads: 64,
      });
    });

    it("maps unusable values to null", () => {
      expect(sanitizeMiniBackendThreadSettings({ intraOpThreads: 0 })).toEqual({
        intraOpThreads: null,
      });
      expect(sanitizeMiniBackendThreadSettings({ intraOpThreads: -3 })).toEqual({
        intraOpThreads: null,
      });
      expect(
        sanitizeMiniBackendThreadSettings({ intraOpThreads: "many" }),
      ).toEqual({ intraOpThreads: null });
      expect(
        sanitizeMiniBackendThreadSettings({ intraOpThreads: Number.NaN }),
      ).toEqual({ intraOpThreads: null });
    });
  });

  describe("load/save round-trip", () => {
    it("returns defaults when nothing is stored", () => {
      expect(loadMiniBackendThreadSettings()).toEqual(
        DEFAULT_MINI_BACKEND_THREAD_SETTINGS,
      );
    });

    it("persists and reloads a sanitized value", () => {
      saveMiniBackendThreadSettings({ intraOpThreads: 8 });
      expect(
        window.localStorage.getItem(MINI_BACKEND_THREAD_SETTINGS_STORAGE_KEY),
      ).toBe(JSON.stringify({ intraOpThreads: 8 }));
      expect(loadMiniBackendThreadSettings()).toEqual({ intraOpThreads: 8 });
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
      expect(loadMiniBackendThreadSettings()).toEqual({
        intraOpThreads: null,
      });
    });
  });
});
