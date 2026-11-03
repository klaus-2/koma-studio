import test from "node:test";
import assert from "node:assert/strict";

import {
  parseUpdaterEventPayload,
  parseUpdaterStatusPayload,
} from "./desktop-events.ts";

const validState = {
  status: "downloading",
  currentVersion: "1.3.1",
  newVersion: "1.4.0",
  mandatory: false,
  blocking: false,
  blockingReason: null,
  releaseNotes: "notes",
  channel: "stable",
  provider: "github",
  autoInstallOnQuit: true,
  allowPrerelease: false,
  progress: { percent: 42.5, transferred: 10, total: 24, speed: 3 },
  checkedAt: 100,
  downloadedAt: null,
  error: null,
};

test("parseUpdaterStatusPayload round-trips a valid payload", () => {
  assert.deepEqual(parseUpdaterStatusPayload(validState), validState);
});

test("parseUpdaterStatusPayload accepts null-able fields at their null variants", () => {
  const state = {
    ...validState,
    status: "idle",
    currentVersion: null,
    newVersion: null,
    releaseNotes: null,
    progress: null,
    checkedAt: null,
    downloadedAt: null,
    error: null,
    blockingReason: "mandatory-update",
    channel: "beta",
    provider: "generic",
  };

  assert.deepEqual(parseUpdaterStatusPayload(state), state);
});

const invalidStates: Array<[string, Record<string, unknown>]> = [
  ["unknown status", { ...validState, status: "paused" }],
  ["non-string currentVersion", { ...validState, currentVersion: 42 }],
  ["non-boolean mandatory", { ...validState, mandatory: "no" }],
  ["invalid blockingReason", { ...validState, blockingReason: "because" }],
  ["invalid channel", { ...validState, channel: "canary" }],
  ["invalid provider", { ...validState, provider: "gitlab" }],
  ["non-boolean allowPrerelease", { ...validState, allowPrerelease: 1 }],
  ["non-finite progress percent", { ...validState, progress: { ...validState.progress, percent: Number.NaN } }],
  ["non-finite progress speed", { ...validState, progress: { ...validState.progress, speed: Number.POSITIVE_INFINITY } }],
  ["progress with missing field", { ...validState, progress: { percent: 1, transferred: 2, total: 3 } }],
  ["progress wrong type", { ...validState, progress: "42%" }],
  ["non-number checkedAt", { ...validState, checkedAt: "now" }],
  ["NaN downloadedAt", { ...validState, downloadedAt: Number.NaN }],
  ["non-string error", { ...validState, error: 7 }],
  ["missing field", { ...validState, autoInstallOnQuit: undefined }],
];

for (const [label, payload] of invalidStates) {
  test(`parseUpdaterStatusPayload rejects ${label}`, () => {
    assert.equal(parseUpdaterStatusPayload(payload), null);
  });
}

test("parseUpdaterStatusPayload rejects non-objects", () => {
  assert.equal(parseUpdaterStatusPayload(null), null);
  assert.equal(parseUpdaterStatusPayload("state"), null);
  assert.equal(parseUpdaterStatusPayload(undefined), null);
});

test("parseUpdaterEventPayload round-trips a valid event", () => {
  const payload = { event: "progress", state: validState };

  assert.deepEqual(parseUpdaterEventPayload(payload), payload);
});

test("parseUpdaterEventPayload rejects unknown event names", () => {
  assert.equal(parseUpdaterEventPayload({ event: "cancelled", state: validState }), null);
  assert.equal(parseUpdaterEventPayload({ state: validState }), null);
});

test("parseUpdaterEventPayload rejects invalid state payloads", () => {
  assert.equal(
    parseUpdaterEventPayload({ event: "progress", state: { ...validState, status: 9 } }),
    null,
  );
  assert.equal(parseUpdaterEventPayload({ event: "progress" }), null);
});

test("parseUpdaterEventPayload rejects non-objects", () => {
  assert.equal(parseUpdaterEventPayload("progress"), null);
  assert.equal(parseUpdaterEventPayload(null), null);
});
