import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_WORKSPACE_PRELOAD_SETTINGS,
  WORKSPACE_PRELOAD_SETTINGS_STORAGE_KEY,
  loadWorkspacePreloadSettings,
  sanitizeWorkspacePreloadSettings,
  saveWorkspacePreloadSettings,
} from './workspacePreloadSettings';

describe('workspacePreloadSettings', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('sanitizeWorkspacePreloadSettings', () => {
    it('clamps values below the window to 0 (off)', () => {
      expect(sanitizeWorkspacePreloadSettings({ archivePreloadPages: -1 })).toEqual({
        archivePreloadPages: 0,
      });
    });

    it('clamps values above the window to 8', () => {
      expect(sanitizeWorkspacePreloadSettings({ archivePreloadPages: 99 })).toEqual({
        archivePreloadPages: 8,
      });
    });

    it('falls back to the default for non-numeric values', () => {
      expect(sanitizeWorkspacePreloadSettings({ archivePreloadPages: 'abc' })).toEqual(
        DEFAULT_WORKSPACE_PRELOAD_SETTINGS,
      );
      expect(
        sanitizeWorkspacePreloadSettings({ archivePreloadPages: Number.NaN }),
      ).toEqual(DEFAULT_WORKSPACE_PRELOAD_SETTINGS);
    });

    it('falls back to the default for null, empty and boolean values instead of 0', () => {
      expect(sanitizeWorkspacePreloadSettings({ archivePreloadPages: null })).toEqual(
        DEFAULT_WORKSPACE_PRELOAD_SETTINGS,
      );
      expect(sanitizeWorkspacePreloadSettings({ archivePreloadPages: '' })).toEqual(
        DEFAULT_WORKSPACE_PRELOAD_SETTINGS,
      );
      expect(
        sanitizeWorkspacePreloadSettings({ archivePreloadPages: false }),
      ).toEqual(DEFAULT_WORKSPACE_PRELOAD_SETTINGS);
      expect(
        sanitizeWorkspacePreloadSettings({ archivePreloadPages: undefined }),
      ).toEqual(DEFAULT_WORKSPACE_PRELOAD_SETTINGS);
    });

    it('accepts numeric strings from the text-field input', () => {
      expect(sanitizeWorkspacePreloadSettings({ archivePreloadPages: '3' })).toEqual({
        archivePreloadPages: 3,
      });
      expect(sanitizeWorkspacePreloadSettings({ archivePreloadPages: '0' })).toEqual({
        archivePreloadPages: 0,
      });
      expect(sanitizeWorkspacePreloadSettings({ archivePreloadPages: '  ' })).toEqual(
        DEFAULT_WORKSPACE_PRELOAD_SETTINGS,
      );
    });

    it('returns the defaults for null, arrays and non-object payloads', () => {
      expect(sanitizeWorkspacePreloadSettings(null)).toEqual(
        DEFAULT_WORKSPACE_PRELOAD_SETTINGS,
      );
      expect(sanitizeWorkspacePreloadSettings([1])).toEqual(
        DEFAULT_WORKSPACE_PRELOAD_SETTINGS,
      );
      expect(sanitizeWorkspacePreloadSettings('nope')).toEqual(
        DEFAULT_WORKSPACE_PRELOAD_SETTINGS,
      );
    });
  });

  describe('loadWorkspacePreloadSettings', () => {
    it('returns the defaults when nothing is stored', () => {
      expect(loadWorkspacePreloadSettings()).toEqual(
        DEFAULT_WORKSPACE_PRELOAD_SETTINGS,
      );
    });

    it('parses a stored payload', () => {
      window.localStorage.setItem(
        WORKSPACE_PRELOAD_SETTINGS_STORAGE_KEY,
        JSON.stringify({ archivePreloadPages: 4 }),
      );
      expect(loadWorkspacePreloadSettings()).toEqual({ archivePreloadPages: 4 });
    });

    it('sanitizes a corrupted stored payload', () => {
      window.localStorage.setItem(
        WORKSPACE_PRELOAD_SETTINGS_STORAGE_KEY,
        JSON.stringify({ archivePreloadPages: -3 }),
      );
      expect(loadWorkspacePreloadSettings()).toEqual({ archivePreloadPages: 0 });
    });

    it('returns the defaults for unparseable stored data', () => {
      window.localStorage.setItem(
        WORKSPACE_PRELOAD_SETTINGS_STORAGE_KEY,
        '{not-json',
      );
      expect(loadWorkspacePreloadSettings()).toEqual(
        DEFAULT_WORKSPACE_PRELOAD_SETTINGS,
      );
    });
  });

  describe('saveWorkspacePreloadSettings', () => {
    it('persists the sanitized value and dispatches the change event', () => {
      const dispatched: CustomEvent[] = [];
      const listener = (event: Event): void => {
        if (event instanceof CustomEvent) {
          dispatched.push(event);
        }
      };
      window.addEventListener(
        'koma:workspace-preload-settings-changed',
        listener,
      );

      const saved = saveWorkspacePreloadSettings({ archivePreloadPages: 5 });

      expect(saved).toEqual({ archivePreloadPages: 5 });
      expect(window.localStorage.getItem(WORKSPACE_PRELOAD_SETTINGS_STORAGE_KEY)).toBe(
        JSON.stringify({ archivePreloadPages: 5 }),
      );
      expect(dispatched).toHaveLength(1);
      expect(dispatched[0]?.detail).toEqual({ archivePreloadPages: 5 });

      window.removeEventListener(
        'koma:workspace-preload-settings-changed',
        listener,
      );
    });

    it('roundtrips through save and load', () => {
      saveWorkspacePreloadSettings({ archivePreloadPages: 7 });
      expect(loadWorkspacePreloadSettings()).toEqual({ archivePreloadPages: 7 });
    });
  });
});
