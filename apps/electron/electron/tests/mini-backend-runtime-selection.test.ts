import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  readMiniBackendRuntimeSelection,
  resolveRequestedRuntimeProfile,
  resolveSelectedRuntimeBinaryPath,
  writeMiniBackendRuntimeSelection,
} from "../mini-backend-runtime-selection.ts";

test("writeMiniBackendRuntimeSelection persists the selected runtime profile metadata", () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "koma-runtime-selection-"));

  writeMiniBackendRuntimeSelection(userDataDir, {
    profile: "nvidia-cuda-legacy",
    version: "1.2.3",
    entry: "mini-backend.exe",
  });

  assert.deepEqual(readMiniBackendRuntimeSelection(userDataDir), {
    profile: "nvidia-cuda-legacy",
    version: "1.2.3",
    entry: "mini-backend.exe",
  });
});

test("resolveSelectedRuntimeBinaryPath returns null when no manual runtime selection exists", () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "koma-runtime-selection-empty-"));

  assert.equal(resolveSelectedRuntimeBinaryPath(userDataDir), null);
});

test("resolveSelectedRuntimeBinaryPath returns the installed binary path for the selected profile", () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "koma-runtime-selection-path-"));
  const runtimeDir = path.join(userDataDir, "mini-backend-runtimes", "1.2.3", "nvidia-cuda-legacy");
  fs.mkdirSync(runtimeDir, { recursive: true });
  fs.writeFileSync(path.join(runtimeDir, "mini-backend.exe"), "binary");

  writeMiniBackendRuntimeSelection(userDataDir, {
    profile: "nvidia-cuda-legacy",
    version: "1.2.3",
    entry: "mini-backend.exe",
  });

  const resolvedPath = resolveSelectedRuntimeBinaryPath(userDataDir);

  assert.equal(resolvedPath, path.join(runtimeDir, "mini-backend.exe"));
});

test("resolveRequestedRuntimeProfile prefers persisted manual selection when no explicit env override exists", () => {
  const resolvedProfile = resolveRequestedRuntimeProfile({
    envOverrideProfile: "auto",
    selectedProfile: "intel-openvino",
  });

  assert.equal(resolvedProfile, "intel-openvino");
});

test("resolveRequestedRuntimeProfile keeps explicit env override ahead of persisted manual selection", () => {
  const resolvedProfile = resolveRequestedRuntimeProfile({
    envOverrideProfile: "nvidia-cuda-legacy",
    selectedProfile: "intel-openvino",
  });

  assert.equal(resolvedProfile, "nvidia-cuda-legacy");
});

test("resolveRequestedRuntimeProfile can ignore persisted manual selection for recommendation-only flows", () => {
  const resolvedProfile = resolveRequestedRuntimeProfile({
    envOverrideProfile: "auto",
    selectedProfile: "intel-openvino",
    ignoreManualSelection: true,
  });

  assert.equal(resolvedProfile, "auto");
});
