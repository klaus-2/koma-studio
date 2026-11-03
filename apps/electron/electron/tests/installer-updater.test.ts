import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  applyUpdaterTransition,
  createInitialUpdaterState,
  normalizeUpdaterReleaseNotes,
  type UpdaterTransition,
} from "../updater/installer-updater-shared.ts";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

test("keeps a non-empty release-notes string", () => {
  assert.equal(normalizeUpdaterReleaseNotes("  # v1.4.0\n\n- fix  "), "# v1.4.0\n\n- fix");
});

test("maps a blank release-notes string to null", () => {
  assert.equal(normalizeUpdaterReleaseNotes("   "), null);
});

test("joins per-version note objects and drops empty notes", () => {
  const notes: unknown = [
    { version: "1.4.0", note: "First note" },
    { version: "1.3.9", note: "   " },
    { version: "1.3.8", note: "Second note" },
    "garbage",
    null,
  ];

  assert.equal(normalizeUpdaterReleaseNotes(notes), "First note\n\nSecond note");
});

test("returns null for an all-empty note list", () => {
  const notes: unknown = [
    { version: "1.4.0", note: "" },
    { version: "1.3.9", note: null },
  ];

  assert.equal(normalizeUpdaterReleaseNotes(notes), null);
});

test("returns null for non-string non-array payloads", () => {
  assert.equal(normalizeUpdaterReleaseNotes(null), null);
  assert.equal(normalizeUpdaterReleaseNotes(undefined), null);
  assert.equal(normalizeUpdaterReleaseNotes(42), null);
  assert.equal(normalizeUpdaterReleaseNotes({ note: "nope" }), null);
});

const goldenPath = path.resolve(
  scriptDir,
  "..",
  "..",
  "scripts",
  "fixtures",
  "updater-transitions.golden.json",
);
const golden = JSON.parse(readFileSync(goldenPath, "utf8")) as {
  scenarios: Array<{
    name: string;
    initialVersion: string;
    channel: string;
    preTransitions: UpdaterTransition[];
    transition: UpdaterTransition;
    expectedState: Record<string, unknown>;
  }>;
};

for (const scenario of golden.scenarios) {
  test(`golden reducer parity: ${scenario.name}`, () => {
    let state = createInitialUpdaterState(scenario.initialVersion);
    for (const transition of scenario.preTransitions) {
      state = applyUpdaterTransition(state, transition, scenario.channel as "stable" | "beta");
    }
    state = applyUpdaterTransition(state, scenario.transition, scenario.channel as "stable" | "beta");

    assert.deepEqual(state, scenario.expectedState);
  });
}
