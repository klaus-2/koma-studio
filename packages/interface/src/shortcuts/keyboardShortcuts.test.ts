import { describe, expect, it } from "vitest";

import {
  SHORTCUT_ACTIONS,
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
