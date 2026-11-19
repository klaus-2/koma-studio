import { describe, expect, it } from "vitest";

import {
  DEFAULT_KEYBOARD_SHORTCUT_CONFIG,
  SHORTCUT_ACTIONS,
  SHORTCUT_ACTIONS_BY_ID,
  getShortcutConflict,
  sanitizeKeyboardShortcutConfig,
} from "@/shortcuts/keyboardShortcuts";

describe("sanitizeKeyboardShortcutConfig", () => {
  it("falls back to defaultCombo for actions absent from a fresh persisted config", () => {
    const sanitized = sanitizeKeyboardShortcutConfig({ version: 2, shortcuts: {} });

    const paletteAction = SHORTCUT_ACTIONS.find(
      (action) => action.id === "openCommandPalette",
    );
    expect(paletteAction?.defaultCombo).toEqual(["CTRL", "K"]);
    expect(sanitized.version).toBe(2);
    expect(sanitized.shortcuts.openCommandPalette).toEqual(["CTRL", "K"]);
  });

  it("preserves a persisted combo for another action", () => {
    const sanitized = sanitizeKeyboardShortcutConfig({
      version: 2,
      shortcuts: { workspaceSave: ["CTRL", "ALT", "S"] },
    });

    expect(sanitized.shortcuts.workspaceSave).toEqual(["CTRL", "ALT", "S"]);
    // The palette keeps its default: the persisted config predates the action.
    expect(sanitized.shortcuts.openCommandPalette).toEqual(["CTRL", "K"]);
  });

  it("resets an empty persisted combo to the action default", () => {
    const sanitized = sanitizeKeyboardShortcutConfig({
      version: 2,
      shortcuts: { workspaceSave: [] },
    });

    const saveAction = SHORTCUT_ACTIONS.find(
      (action) => action.id === "workspaceSave",
    );
    expect(sanitized.shortcuts.workspaceSave).toEqual(saveAction?.defaultCombo);
  });
});

describe("peekOriginalPage shortcut", () => {
  it("is registered with the prescribed definition and default combo", () => {
    const action = SHORTCUT_ACTIONS_BY_ID.peekOriginalPage;
    expect(action).toBeDefined();
    expect(action?.category).toBe("global");
    expect(action?.modeGuard).toBe("requires-active-image");
    expect(action?.defaultCombo).toEqual(["ALT", "O"]);
    expect(action?.isEnabled({
      mode: "aio",
      subMode: "auto",
      translatorWorkspaceMode: null,
      activeId: "img-1",
      activeSelectedRegionId: null,
      aioRenderReady: false,
      processing: false,
    })).toBe(true);
    expect(action?.isEnabled({
      mode: "aio",
      subMode: "auto",
      translatorWorkspaceMode: null,
      activeId: null,
      activeSelectedRegionId: null,
      aioRenderReady: false,
      processing: false,
    })).toBe(false);
    expect(action?.isEnabled({
      mode: "aio",
      subMode: "auto",
      translatorWorkspaceMode: null,
      activeId: "img-1",
      activeSelectedRegionId: null,
      aioRenderReady: false,
      processing: true,
    })).toBe(false);
  });

  it("has no combo conflict for the default ALT+O", () => {
    const conflict = getShortcutConflict(
      DEFAULT_KEYBOARD_SHORTCUT_CONFIG,
      "peekOriginalPage",
      ["ALT", "O"],
    );
    expect(conflict).toBeNull();
  });

  it("merges the new id with its default into a stored v2 config", () => {
    const legacyStored = {
      version: 2 as const,
      shortcuts: { workspaceSave: ["CTRL", "ALT", "S"] },
    };
    const sanitized = sanitizeKeyboardShortcutConfig(legacyStored);
    expect(sanitized.shortcuts.peekOriginalPage).toEqual(["ALT", "O"]);
    expect(sanitized.shortcuts.workspaceSave).toEqual(["CTRL", "ALT", "S"]);
  });
});
