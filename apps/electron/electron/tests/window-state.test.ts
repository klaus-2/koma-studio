import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  clampBoundsIntoWorkArea,
  getWindowStateFilePath,
  parseWindowStatePayload,
  persistWindowBoundsOnClose,
  readWindowStateFile,
  resolveRestoredPlacement,
  restoredBrowserWindowOptions,
  writeWindowStateFile,
} from "../modules/window-state.ts";

const makeTempDir = (): string =>
  fs.mkdtempSync(path.join(os.tmpdir(), "koma-window-state-"));

const WORK_AREA = { x: 0, y: 0, width: 1920, height: 1040 };

test("parseWindowStatePayload accepts a valid window state", () => {
  assert.deepEqual(
    parseWindowStatePayload({
      bounds: { x: 10, y: 20, width: 1280, height: 860 },
      maximized: true,
    }),
    { bounds: { x: 10, y: 20, width: 1280, height: 860 }, maximized: true },
  );
  assert.deepEqual(
    parseWindowStatePayload({
      bounds: { x: -10, y: 0, width: 1280, height: 860 },
      maximized: false,
    }),
    { bounds: { x: -10, y: 0, width: 1280, height: 860 }, maximized: false },
  );
});

test("parseWindowStatePayload rejects malformed payloads", () => {
  assert.equal(parseWindowStatePayload(null), null);
  assert.equal(parseWindowStatePayload("window-state"), null);
  assert.equal(parseWindowStatePayload([]), null);
  assert.equal(parseWindowStatePayload({ maximized: false }), null);
  assert.equal(parseWindowStatePayload({ bounds: null, maximized: false }), null);
  assert.equal(
    parseWindowStatePayload({
      bounds: { x: 0, y: 0, width: -5, height: 100 },
      maximized: false,
    }),
    null,
  );
  assert.equal(
    parseWindowStatePayload({
      bounds: { x: 0, y: 0, width: 0, height: 100 },
      maximized: false,
    }),
    null,
  );
  assert.equal(
    parseWindowStatePayload({
      bounds: { x: Number.NaN, y: 0, width: 100, height: 100 },
      maximized: false,
    }),
    null,
  );
  assert.equal(
    parseWindowStatePayload({ bounds: { x: 0, y: 0, width: 100 }, maximized: false }),
    null,
  );
  assert.deepEqual(
    parseWindowStatePayload({
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      maximized: "yes",
    }),
    { bounds: { x: 0, y: 0, width: 100, height: 100 }, maximized: false },
  );
});

test("clampBoundsIntoWorkArea keeps fully visible bounds untouched", () => {
  assert.deepEqual(
    clampBoundsIntoWorkArea({ x: 100, y: 50, width: 1280, height: 860 }, WORK_AREA),
    { x: 100, y: 50, width: 1280, height: 860 },
  );
});

test("clampBoundsIntoWorkArea pulls off-screen windows back into the work area", () => {
  assert.deepEqual(
    clampBoundsIntoWorkArea({ x: -900, y: 2000, width: 1280, height: 860 }, WORK_AREA),
    { x: 0, y: 180, width: 1280, height: 860 },
  );
  assert.deepEqual(
    clampBoundsIntoWorkArea({ x: 2500, y: -400, width: 800, height: 600 }, WORK_AREA),
    { x: 1120, y: 0, width: 800, height: 600 },
  );
});

test("clampBoundsIntoWorkArea caps bounds larger than the work area", () => {
  assert.deepEqual(
    clampBoundsIntoWorkArea({ x: 0, y: 0, width: 4000, height: 3000 }, WORK_AREA),
    { x: 0, y: 0, width: 1920, height: 1040 },
  );
});

test("window state file round-trips through a userData directory", () => {
  const userDataPath = makeTempDir();
  try {
    assert.equal(readWindowStateFile(userDataPath), null);
    assert.equal(
      getWindowStateFilePath(userDataPath),
      path.join(userDataPath, "window-state.json"),
    );

    const state = { bounds: { x: 12, y: 34, width: 1280, height: 860 }, maximized: true };
    writeWindowStateFile(userDataPath, state);
    assert.deepEqual(readWindowStateFile(userDataPath), state);
    assert.deepEqual(
      JSON.parse(fs.readFileSync(getWindowStateFilePath(userDataPath), "utf-8")),
      state,
    );
  } finally {
    fs.rmSync(userDataPath, { recursive: true, force: true });
  }
});

test("readWindowStateFile returns null for corrupt or invalid content", () => {
  const userDataPath = makeTempDir();
  try {
    fs.writeFileSync(getWindowStateFilePath(userDataPath), "{not-json");
    assert.equal(readWindowStateFile(userDataPath), null);

    fs.writeFileSync(
      getWindowStateFilePath(userDataPath),
      JSON.stringify({ bounds: { x: 1 }, maximized: false }),
    );
    assert.equal(readWindowStateFile(userDataPath), null);
  } finally {
    fs.rmSync(userDataPath, { recursive: true, force: true });
  }
});

test("resolveRestoredPlacement clamps saved bounds into the matching display", () => {
  const userDataPath = makeTempDir();
  try {
    assert.equal(resolveRestoredPlacement(userDataPath, {
      getDisplayMatching: () => ({ workArea: WORK_AREA }),
    }), null);

    writeWindowStateFile(userDataPath, {
      bounds: { x: -900, y: 2000, width: 1280, height: 860 },
      maximized: true,
    });
    assert.deepEqual(
      resolveRestoredPlacement(userDataPath, {
        getDisplayMatching: () => ({ workArea: WORK_AREA }),
      }),
      { bounds: { x: 0, y: 180, width: 1280, height: 860 }, maximized: true },
    );
  } finally {
    fs.rmSync(userDataPath, { recursive: true, force: true });
  }
});

test("restoredBrowserWindowOptions keeps the default size without a saved placement", () => {
  assert.deepEqual(restoredBrowserWindowOptions(null), { width: 1280, height: 860 });
  assert.deepEqual(
    restoredBrowserWindowOptions({
      bounds: { x: 40, y: 60, width: 1000, height: 700 },
      maximized: false,
    }),
    { width: 1000, height: 700, x: 40, y: 60 },
  );
});

test("persistWindowBoundsOnClose writes normal bounds on close", () => {
  const userDataPath = makeTempDir();
  const closeListeners: Array<() => void> = [];
  const fakeWindow = {
    isDestroyed: () => false,
    getNormalBounds: () => ({ x: 5, y: 6, width: 1000, height: 700 }),
    isMaximized: () => false,
    on: (_event: "close", listener: () => void) => {
      closeListeners.push(listener);
      return undefined;
    },
  };

  try {
    persistWindowBoundsOnClose(fakeWindow, userDataPath);
    assert.equal(closeListeners.length, 1);
    closeListeners[0]?.();
    assert.deepEqual(readWindowStateFile(userDataPath), {
      bounds: { x: 5, y: 6, width: 1000, height: 700 },
      maximized: false,
    });
  } finally {
    fs.rmSync(userDataPath, { recursive: true, force: true });
  }
});
