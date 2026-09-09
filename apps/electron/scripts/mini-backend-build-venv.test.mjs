import test from "node:test";
import assert from "node:assert/strict";

import {
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

test("resolveRuntimeArtifactBuildVenvLinkPath creates a repo-local alias for the dedicated build venv", () => {
  const result = resolveRuntimeArtifactBuildVenvLinkPath({
    profileKey: "nvidia-cuda-legacy",
    rootDir: "C:\\GitHub\\koma-studio\\koma-studio",
  });

  assert.equal(result, "C:\\GitHub\\koma-studio\\koma-studio\\.venv-mini-build-nvidia-cuda-legacy");
});
