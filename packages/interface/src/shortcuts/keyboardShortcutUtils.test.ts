import { describe, expect, test } from "vitest";

import {
  collectShortcutStateFromKeyboardEvent,
  getShortcutDisplayLabel,
  isEditableShortcutTarget,
  isShortcutMatch,
  normalizeShortcutCombo,
} from "./keyboardShortcuts";

describe("keyboard shortcut utils", () => {
  test("normalizes aliases, removes duplicates, and keeps modifiers first", () => {
    expect(normalizeShortcutCombo(["s", "control", "CTRL", "shift"])).toEqual([
      "CTRL",
      "SHIFT",
      "S",
    ]);
    expect(normalizeShortcutCombo(["command", "spacebar"])).toEqual(["WIN", "SPACE"]);
  });

  test("collects normalized key state from keyboard events", () => {
    const event = new KeyboardEvent("keydown", {
      code: "KeyK",
      key: "k",
      ctrlKey: true,
      shiftKey: true,
    });

    expect(collectShortcutStateFromKeyboardEvent(event)).toEqual(["CTRL", "SHIFT", "K"]);
  });

  test("matches shortcuts independent of input order", () => {
    expect(isShortcutMatch(["K", "CTRL"], ["control", "k"])).toBe(true);
    expect(isShortcutMatch(["CTRL"], ["CTRL", "K"])).toBe(false);
  });

  test("formats empty and assigned shortcut labels", () => {
    expect(getShortcutDisplayLabel([], "No shortcut")).toBe("No shortcut");
    expect(getShortcutDisplayLabel(["CTRL", "K"])).toBe("CTRL + K");
  });

  test("detects editable shortcut targets", () => {
    expect(isEditableShortcutTarget(document.createElement("input"))).toBe(true);
    expect(isEditableShortcutTarget(document.createElement("button"))).toBe(false);
  });
});
