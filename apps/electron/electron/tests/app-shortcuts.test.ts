import test from "node:test";
import assert from "node:assert/strict";

import { resolveDesktopShortcutAction } from "../app-shortcuts.ts";

test("resolveDesktopShortcutAction maps Ctrl+S to workspaceSave", () => {
  assert.equal(
    resolveDesktopShortcutAction({
      type: "keyDown",
      key: "s",
      control: true,
      alt: false,
      shift: false,
      meta: false,
    }),
    "workspaceSave",
  );
});

test("resolveDesktopShortcutAction ignores unrelated shortcuts", () => {
  assert.equal(
    resolveDesktopShortcutAction({
      type: "keyDown",
      key: "z",
      control: true,
      alt: false,
      shift: false,
      meta: false,
    }),
    null,
  );
  assert.equal(
    resolveDesktopShortcutAction({
      type: "keyUp",
      key: "s",
      control: true,
      alt: false,
      shift: false,
      meta: false,
    }),
    null,
  );
});
