import test from "node:test";
import assert from "node:assert/strict";

import {
  applyBatchState,
  applyDirtyFlag,
  commitBatchShellState,
  consumeForceClose,
  createBatchShellState,
  formatBatchTrayPauseLabel,
  formatBatchTrayTooltip,
  getBatchShellState,
  keepAwakeDesired,
  parseBatchStatePayload,
  resolveBatchTrayAction,
  setForceClose,
  shouldPreventClose,
  subscribeToBatchShellState,
  syncKeepAwakeWithState,
  type BatchShellState,
  type Blocker,
} from "../modules/batch-state.ts";

interface FakeBlockerCalls {
  started: string[];
  stopped: number[];
  nextId: number;
}

const createFakeBlocker = (calls: FakeBlockerCalls): Blocker => ({
  start: (type) => {
    calls.started.push(type);
    calls.nextId += 1;
    return calls.nextId;
  },
  stop: (id) => {
    calls.stopped.push(id);
  },
});

const RUNNING_STATE: BatchShellState = {
  phase: "running",
  done: 3,
  total: 4,
  label: "page 3",
  dirty: false,
  forceClose: false,
  blockerId: null,
};

test("createBatchShellState starts idle, clean, and without a blocker", () => {
  assert.deepEqual(createBatchShellState(), {
    phase: "idle",
    done: 0,
    total: 0,
    label: null,
    dirty: false,
    forceClose: false,
    blockerId: null,
  });
});

test("parseBatchStatePayload accepts a well-formed batch state payload", () => {
  assert.deepEqual(
    parseBatchStatePayload({ phase: "running", done: 2, total: 10, label: "ocr" }),
    { phase: "running", done: 2, total: 10, label: "ocr" },
  );
  assert.deepEqual(parseBatchStatePayload({ phase: "idle", done: 0, total: 0 }), {
    phase: "idle",
    done: 0,
    total: 0,
    label: null,
  });
});

test("parseBatchStatePayload rejects malformed payloads", () => {
  assert.equal(parseBatchStatePayload(null), null);
  assert.equal(parseBatchStatePayload("running"), null);
  assert.equal(parseBatchStatePayload([]), null);
  assert.equal(parseBatchStatePayload({ done: 0, total: 0 }), null);
  assert.equal(parseBatchStatePayload({ phase: "paused" }), null);
  assert.equal(parseBatchStatePayload({ phase: "cancelled", done: 0, total: 0 }), null);
  assert.equal(parseBatchStatePayload({ phase: "running", done: "2", total: 10 }), null);
  assert.equal(parseBatchStatePayload({ phase: "running", done: 2, total: Number.NaN }), null);
  assert.equal(
    parseBatchStatePayload({ phase: "running", done: Number.POSITIVE_INFINITY, total: 10 }),
    null,
  );
});

test("applyBatchState always accepts the transition and normalizes fields", () => {
  const base = createBatchShellState();
  assert.deepEqual(applyBatchState(base, { phase: "running", done: 1, total: 5, label: " render " }), {
    ...base,
    phase: "running",
    done: 1,
    total: 5,
    label: "render",
  });
  assert.deepEqual(applyBatchState(base, { phase: "paused", done: 2, total: 5, label: "   " }).label, null);
  assert.deepEqual(applyBatchState(base, { phase: "error", done: 0, total: 0, label: null }).phase, "error");
  assert.deepEqual(
    applyBatchState(base, { phase: "idle", done: -3, total: Number.NaN }).done,
    0,
  );
});

test("applyBatchState preserves dirty, forceClose, and blockerId", () => {
  const base: BatchShellState = { ...RUNNING_STATE, dirty: true, forceClose: true, blockerId: 7 };
  const next = applyBatchState(base, { phase: "paused", done: 3, total: 4, label: null });
  assert.deepEqual(next, {
    phase: "paused",
    done: 3,
    total: 4,
    label: null,
    dirty: true,
    forceClose: true,
    blockerId: 7,
  });
});

test("applyDirtyFlag toggles the dirty flag", () => {
  const base = createBatchShellState();
  assert.equal(applyDirtyFlag(base, true).dirty, true);
  assert.equal(applyDirtyFlag(applyDirtyFlag(base, true), false).dirty, false);
});

test("setForceClose and consumeForceClose implement the one-shot flag", () => {
  const flagged = setForceClose(createBatchShellState(), true);
  assert.equal(flagged.forceClose, true);
  assert.equal(consumeForceClose(flagged).forceClose, false);
  assert.equal(consumeForceClose(createBatchShellState()).forceClose, false);
});

test("shouldPreventClose blocks while a batch is active or the window is dirty", () => {
  const clean = createBatchShellState();
  assert.equal(shouldPreventClose(clean, clean.forceClose), false);
  assert.equal(shouldPreventClose(applyDirtyFlag(clean, true), false), true);
  assert.equal(shouldPreventClose(RUNNING_STATE, false), true);
  assert.equal(shouldPreventClose({ ...RUNNING_STATE, phase: "paused" }, false), true);
  assert.equal(shouldPreventClose({ ...RUNNING_STATE, phase: "error" }, false), true);
});

test("shouldPreventClose lets force-close pass through in every state", () => {
  assert.equal(shouldPreventClose(RUNNING_STATE, true), false);
  assert.equal(shouldPreventClose(applyDirtyFlag(RUNNING_STATE, true), true), false);
  assert.equal(shouldPreventClose(createBatchShellState(), true), false);
});

test("keepAwakeDesired is true only while the batch is running", () => {
  assert.equal(keepAwakeDesired(RUNNING_STATE), true);
  assert.equal(keepAwakeDesired(createBatchShellState()), false);
  assert.equal(keepAwakeDesired({ ...RUNNING_STATE, phase: "paused" }), false);
  assert.equal(keepAwakeDesired({ ...RUNNING_STATE, phase: "error" }), false);
});

test("syncKeepAwakeWithState starts the blocker exactly once while running", () => {
  const calls: FakeBlockerCalls = { started: [], stopped: [], nextId: 0 };
  const blocker = createFakeBlocker(calls);
  const idle = syncKeepAwakeWithState(createBatchShellState(), blocker);
  assert.equal(idle.blockerId, null);
  assert.equal(calls.started.length, 0);

  const running = syncKeepAwakeWithState(RUNNING_STATE, blocker);
  assert.deepEqual(calls.started, ["prevent-app-suspension"]);
  assert.equal(running.blockerId, 1);

  const stillRunning = syncKeepAwakeWithState(running, blocker);
  assert.equal(calls.started.length, 1);
  assert.equal(stillRunning.blockerId, 1);
});

test("syncKeepAwakeWithState stops the blocker on idle, pause, and error", () => {
  const calls: FakeBlockerCalls = { started: [], stopped: [], nextId: 0 };
  const blocker = createFakeBlocker(calls);
  const running = syncKeepAwakeWithState(RUNNING_STATE, blocker);
  const paused = syncKeepAwakeWithState({ ...running, phase: "paused" }, blocker);
  assert.deepEqual(calls.stopped, [running.blockerId]);
  assert.equal(paused.blockerId, null);

  const pausedWithoutBlocker = syncKeepAwakeWithState(paused, blocker);
  assert.equal(calls.stopped.length, 1);
  assert.equal(pausedWithoutBlocker, paused);

  const errorWithoutBlocker = syncKeepAwakeWithState({ ...RUNNING_STATE, phase: "error" }, blocker);
  assert.equal(calls.started.length, 1);
  assert.equal(calls.stopped.length, 1);
  assert.equal(errorWithoutBlocker.blockerId, null);

  const runningAgain = syncKeepAwakeWithState(RUNNING_STATE, blocker);
  assert.equal(runningAgain.blockerId, 2);
  const errored = syncKeepAwakeWithState({ ...runningAgain, phase: "error" }, blocker);
  assert.deepEqual(calls.started, ["prevent-app-suspension", "prevent-app-suspension"]);
  assert.deepEqual(calls.stopped, [running.blockerId, runningAgain.blockerId]);
  assert.equal(errored.blockerId, null);
});

test("syncKeepAwakeWithState acquires a fresh blocker after a stop", () => {
  const calls: FakeBlockerCalls = { started: [], stopped: [], nextId: 0 };
  const blocker = createFakeBlocker(calls);
  const first = syncKeepAwakeWithState(RUNNING_STATE, blocker);
  const idle = syncKeepAwakeWithState({ ...first, phase: "idle" }, blocker);
  const second = syncKeepAwakeWithState(RUNNING_STATE, blocker);
  assert.deepEqual(calls.started, ["prevent-app-suspension", "prevent-app-suspension"]);
  assert.notEqual(second.blockerId, first.blockerId);
  assert.equal(idle.blockerId, null);
});

test("formatBatchTrayTooltip shows progress for running and paused batches", () => {
  assert.equal(formatBatchTrayTooltip(RUNNING_STATE), "KŌMA — 3/4 (75%)");
  assert.equal(formatBatchTrayTooltip({ ...RUNNING_STATE, phase: "paused" }), "KŌMA — 3/4 (75%)");
  assert.equal(formatBatchTrayTooltip({ ...RUNNING_STATE, done: 7 }), "KŌMA — 7/4 (100%)");
  assert.equal(formatBatchTrayTooltip({ ...RUNNING_STATE, done: 1, total: 3 }), "KŌMA — 1/3 (33%)");
});

test("formatBatchTrayTooltip falls back to the app name without progress", () => {
  assert.equal(formatBatchTrayTooltip(createBatchShellState()), "KŌMA");
  assert.equal(formatBatchTrayTooltip({ ...RUNNING_STATE, total: 0 }), "KŌMA");
  assert.equal(formatBatchTrayTooltip({ ...RUNNING_STATE, phase: "error" }), "KŌMA");
});

test("tray pause label and action reflect the batch phase", () => {
  assert.equal(formatBatchTrayPauseLabel(RUNNING_STATE), "Pause batch");
  assert.equal(formatBatchTrayPauseLabel({ ...RUNNING_STATE, phase: "paused" }), "Resume batch");
  assert.equal(formatBatchTrayPauseLabel(createBatchShellState()), "Pause batch");
  assert.equal(resolveBatchTrayAction(RUNNING_STATE), "pause");
  assert.equal(resolveBatchTrayAction({ ...RUNNING_STATE, phase: "paused" }), "resume");
});

test("commitBatchShellState notifies subscribers until they unsubscribe", () => {
  const before = getBatchShellState();
  const seen: BatchShellState[] = [];
  const unsubscribe = subscribeToBatchShellState((state) => {
    seen.push(state);
  });

  const updated = commitBatchShellState(applyDirtyFlag(before, true));
  assert.deepEqual(seen, [updated]);
  assert.equal(getBatchShellState(), updated);

  unsubscribe();
  commitBatchShellState(applyDirtyFlag(updated, false));
  assert.equal(seen.length, 1);
});
