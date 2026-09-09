import test from "node:test";
import assert from "node:assert/strict";

import { buildDevPythonRuntimePathCandidates } from "../dev-python-runtime.ts";

const withExternalStorage = <T>(root: string | undefined, fn: () => T): T => {
  const previous = process.env.KOMA_EXTERNAL_STORAGE_ROOT;
  if (root === undefined) {
    delete process.env.KOMA_EXTERNAL_STORAGE_ROOT;
  } else {
    process.env.KOMA_EXTERNAL_STORAGE_ROOT = root;
  }
  try {
    return fn();
  } finally {
    if (previous === undefined) {
      delete process.env.KOMA_EXTERNAL_STORAGE_ROOT;
    } else {
      process.env.KOMA_EXTERNAL_STORAGE_ROOT = previous;
    }
  }
};

test("buildDevPythonRuntimePathCandidates prioritizes profile-specific windows venvs", () => {
  const candidates = withExternalStorage("D:\\external", () =>
    buildDevPythonRuntimePathCandidates(
      "nvidia-cuda",
      "C:\\repo\\koma-studio",
      "win32",
    ),
  );

  assert.deepEqual(candidates, [
    "D:\\external\\.venv-mini-nvidia-cuda\\Scripts\\python.exe",
    "C:\\repo\\koma-studio\\.venv-mini-nvidia-cuda\\Scripts\\python.exe",
    "C:\\repo\\koma-studio\\.venv-mini\\Scripts\\python.exe",
  ]);
});

test("buildDevPythonRuntimePathCandidates supports legacy nvidia profile", () => {
  const candidates = withExternalStorage(undefined, () =>
    buildDevPythonRuntimePathCandidates(
      "nvidia-cuda-legacy",
      "C:\\repo\\koma-studio",
      "win32",
    ),
  );

  assert.deepEqual(candidates, [
    "C:\\repo\\koma-studio\\.venv-mini-nvidia-cuda-legacy\\Scripts\\python.exe",
    "C:\\repo\\koma-studio\\.venv-mini\\Scripts\\python.exe",
  ]);
});

test("buildDevPythonRuntimePathCandidates includes cpu-specific venv before base venv", () => {
  const candidates = withExternalStorage(undefined, () =>
    buildDevPythonRuntimePathCandidates(
      "cpu",
      "C:\\repo\\koma-studio",
      "win32",
    ),
  );

  assert.equal(
    candidates[0],
    "C:\\repo\\koma-studio\\.venv-mini-cpu\\Scripts\\python.exe",
  );
  assert.equal(
    candidates[1],
    "C:\\repo\\koma-studio\\.venv-mini\\Scripts\\python.exe",
  );
});
