import test from "node:test";
import assert from "node:assert/strict";

import {
  CONTAMINATION_PREFIXES,
  checkVenvForContamination,
  findContaminatingPackage,
  resolveRuntimeArtifactBuildVenvLinkPath,
  resolveRuntimeArtifactBuildVenvPath,
} from "./mini-backend-build-venv.mjs";

test("resolveRuntimeArtifactBuildVenvPath uses a dedicated build venv on Windows external storage", () => {
  const result = resolveRuntimeArtifactBuildVenvPath({
    profileKey: "nvidia-cuda-legacy",
    platform: "win32",
    externalStorageRoot: "D:\\KomaStudio\\koma-studio-storage",
    rootDir: "C:\\GitHub\\koma-studio\\koma-studio",
  });

  assert.equal(
    result,
    "D:\\KomaStudio\\koma-studio-storage\\.venv-mini-build-nvidia-cuda-legacy",
  );
});

test("resolveRuntimeArtifactBuildVenvPath falls back to a repo-local build venv on non-Windows hosts", () => {
  const result = resolveRuntimeArtifactBuildVenvPath({
    profileKey: "cpu",
    platform: "linux",
    externalStorageRoot: null,
    rootDir: "/workspace/koma-studio",
  });

  assert.equal(result, "/workspace/koma-studio/.venv-mini-build-cpu");
});

test("resolveRuntimeArtifactBuildVenvLinkPath creates a repo-local alias for the dedicated build venv", { skip: process.platform !== "win32" ? "pins the Windows alias path; the link path is host-native (no platform parameter)" : false }, () => {
  const result = resolveRuntimeArtifactBuildVenvLinkPath({
    profileKey: "nvidia-cuda-legacy",
    rootDir: "C:\\GitHub\\koma-studio\\koma-studio",
  });

  assert.equal(result, "C:\\GitHub\\koma-studio\\koma-studio\\.venv-mini-build-nvidia-cuda-legacy");
});

test("findContaminatingPackage flags nvidia-* in cpu/openvino profiles", () => {
  const pipList = [
    "Package    Version",
    "---------- -------",
    "fastapi    0.115.0",
    "nvidia-cudnn-cu12  9.1.0",
  ].join("\n");
  assert.deepEqual(findContaminatingPackage("cpu", pipList), {
    package: "nvidia-cudnn-cu12",
    prefix: "nvidia-",
  });
  assert.equal(findContaminatingPackage("nvidia-cuda", pipList), null);
  assert.equal(findContaminatingPackage("cpu", "fastapi 0.1"), null);
});

test("checkVenvForContamination treats pip failure as contaminated", () => {
  const failingExec = () => {
    throw new Error("pip missing");
  };
  assert.equal(
    checkVenvForContamination("python", "cpu", { exec: failingExec, log: () => {} }),
    true,
  );
  assert.equal(
    checkVenvForContamination("python", "nvidia-cuda", { exec: failingExec, log: () => {} }),
    false,
  );
});

test("CONTAMINATION_PREFIXES covers cpu and intel-openvino", () => {
  assert.deepEqual(CONTAMINATION_PREFIXES.cpu, ["nvidia-"]);
  assert.deepEqual(CONTAMINATION_PREFIXES["intel-openvino"], ["nvidia-"]);
});
