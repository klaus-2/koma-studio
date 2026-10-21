import test from "node:test";
import assert from "node:assert/strict";

import {
  syncMiniBackendRuntimeStateFromLog,
} from "../modules/mini-backend-supervisor.ts";
import { formatRuntimeFallbackReason } from "../mini-backend-runtime.ts";
import type { MiniBackendRuntimeState } from "../modules/mini-backend-runtime-store.ts";

type PatchCollector = (patch: Partial<MiniBackendRuntimeState>) => void;

const collectPatches = (
  rawText: string,
): Partial<MiniBackendRuntimeState>[] => {
  const patches: Partial<MiniBackendRuntimeState>[] = [];
  const collector: PatchCollector = (patch) => {
    patches.push(patch);
  };
  syncMiniBackendRuntimeStateFromLog(rawText, collector);
  return patches;
};

const expectedFallbackPatch = (): Partial<MiniBackendRuntimeState> => {
  const reason = formatRuntimeFallbackReason("runtime_warmup_fallback_to_cpu");
  return {
    activeProfile: "cpu",
    lastError: reason,
    status: "fallback",
    statusMessage: reason,
  };
};

test("CPU fallback marker patches the runtime state onto the CPU fallback", () => {
  const patches = collectPatches(
    "2026-09-29 12:00:00 [info] Detector warmup: Falling back to CPU automatically",
  );
  assert.equal(patches.length, 1);
  assert.deepEqual(patches[0] ?? null, expectedFallbackPatch());
});

test("detector warmup redo marker patches the runtime state onto the CPU fallback", () => {
  const patches = collectPatches(
    "Detector warmup successfully redone on CPU",
  );
  assert.equal(patches.length, 1);
  assert.deepEqual(patches[0] ?? null, expectedFallbackPatch());
});

test("unrelated log output produces no runtime-state patch", () => {
  assert.deepEqual(collectPatches("warmup.done profile=nvidia-cuda"), []);
  assert.deepEqual(collectPatches("Falling back to CPU eventually maybe"), []);
});

test("blank log output produces no runtime-state patch", () => {
  assert.deepEqual(collectPatches("   \n\t  "), []);
});

test("both legacy markers map onto the same fallback patch shape", () => {
  const first = collectPatches("Falling back to CPU automatically");
  const second = collectPatches("Detector warmup successfully redone on CPU");
  assert.deepEqual(first[0] ?? null, second[0] ?? null);
});
