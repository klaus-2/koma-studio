import test from "node:test";
import assert from "node:assert/strict";

import {
  detectRecommendedProfile,
  expectedOnnxPackageForProfile,
  hasForceRebuildFlag,
  isTruthyEnvFlag,
  parseProfileFromArgs,
  resolveRequestedProfile,
  shouldSkipMiniBackendBuild,
} from "./mini-backend-build-options.mjs";

test("parseProfileFromArgs supports --profile=name and --profile name", () => {
  assert.equal(parseProfileFromArgs(["--profile=nvidia-cuda"]), "nvidia-cuda");
  assert.equal(parseProfileFromArgs(["--profile", "intel-openvino"]), "intel-openvino");
  assert.equal(parseProfileFromArgs(["--other", "--profile=cpu"]), "cpu");
  assert.equal(parseProfileFromArgs([]), null);
  assert.equal(parseProfileFromArgs(["--profile", ""]), null);
  assert.equal(parseProfileFromArgs(["--profile="]), null);
});

test("resolveRequestedProfile prefers CLI arg over env, env over fallback", () => {
  assert.deepEqual(
    resolveRequestedProfile({ argv: ["--profile=cpu"], envProfile: "nvidia-cuda" }),
    { profile: "cpu", source: "arg" },
  );
  assert.deepEqual(
    resolveRequestedProfile({ argv: [], envProfile: "nvidia-cuda" }),
    { profile: "nvidia-cuda", source: "env" },
  );
  assert.deepEqual(
    resolveRequestedProfile({ argv: [], envProfile: "  " }),
    { profile: null, source: null },
  );
  assert.deepEqual(
    resolveRequestedProfile({ argv: [], envProfile: undefined }),
    { profile: null, source: null },
  );
});

test("detectRecommendedProfile picks GPU profile when nvidia-smi exists", () => {
  assert.equal(
    detectRecommendedProfile({ platform: "win32", arch: "x64", commandExists: () => true }),
    "nvidia-cuda",
  );
  assert.equal(
    detectRecommendedProfile({ platform: "linux", arch: "x64", commandExists: () => false }),
    "cpu",
  );
  assert.equal(
    detectRecommendedProfile({ platform: "darwin", arch: "arm64", commandExists: () => false }),
    "apple-mps",
  );
  assert.equal(
    detectRecommendedProfile({ platform: "darwin", arch: "x64", commandExists: () => false }),
    "cpu",
  );
});

test("expectedOnnxPackageForProfile maps every profile to its onnxruntime variant", () => {
  assert.equal(expectedOnnxPackageForProfile("cpu"), "onnxruntime");
  assert.equal(expectedOnnxPackageForProfile("apple-mps"), "onnxruntime");
  assert.equal(expectedOnnxPackageForProfile("nvidia-cuda"), "onnxruntime-gpu");
  assert.equal(expectedOnnxPackageForProfile("nvidia-cuda-legacy"), "onnxruntime-gpu");
  assert.equal(expectedOnnxPackageForProfile("nvidia-tensorrt"), "onnxruntime-gpu");
  assert.equal(expectedOnnxPackageForProfile("intel-openvino"), "onnxruntime-openvino");
  assert.equal(expectedOnnxPackageForProfile("amd-rocm"), "onnxruntime-rocm");
  assert.equal(expectedOnnxPackageForProfile("unknown-profile"), "onnxruntime");
});

test("force flags", () => {
  assert.equal(hasForceRebuildFlag(["--force"]), true);
  assert.equal(hasForceRebuildFlag([]), false);
  assert.equal(isTruthyEnvFlag("1"), true);
  assert.equal(isTruthyEnvFlag("TRUE"), true);
  assert.equal(isTruthyEnvFlag("yes"), true);
  assert.equal(isTruthyEnvFlag("0"), false);
  assert.equal(isTruthyEnvFlag(undefined), false);
});

test("shouldSkipMiniBackendBuild skips only on fresh hash + existing artifact", () => {
  const base = {
    forceRebuild: false,
    customSourceDir: false,
    cachedHash: "aaa",
    currentHash: "aaa",
    distArtifactExists: true,
  };

  assert.equal(shouldSkipMiniBackendBuild(base), true);
  assert.equal(shouldSkipMiniBackendBuild({ ...base, forceRebuild: true }), false);
  assert.equal(shouldSkipMiniBackendBuild({ ...base, customSourceDir: true }), false);
  assert.equal(shouldSkipMiniBackendBuild({ ...base, currentHash: "bbb" }), false);
  assert.equal(shouldSkipMiniBackendBuild({ ...base, distArtifactExists: false }), false);
  assert.equal(shouldSkipMiniBackendBuild({ ...base, currentHash: "" }), false);
});
