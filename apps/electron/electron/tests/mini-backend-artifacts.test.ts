import test from "node:test";
import assert from "node:assert/strict";

import {
  listMiniBackendRuntimeArtifactOptions,
  type MiniBackendRuntimeArtifactManifest,
} from "../mini-backend-artifacts.ts";

test("listMiniBackendRuntimeArtifactOptions marks recommended and installed profiles", () => {
  const manifest: MiniBackendRuntimeArtifactManifest = {
    schemaVersion: 1,
    version: "1.2.3",
    generatedAt: new Date().toISOString(),
    platform: "win32",
    arch: "x64",
    defaultProfile: "cpu",
    profiles: {
      cpu: {
        profile: "cpu",
        version: "1.2.3",
        platform: "win32",
        arch: "x64",
        fileName: "cpu.zip",
        url: "cpu.zip",
        sha512: "cpu",
        size: 100,
        entry: "mini-backend.exe",
      },
      "nvidia-cuda-legacy": {
        profile: "nvidia-cuda-legacy",
        version: "1.2.3",
        platform: "win32",
        arch: "x64",
        fileName: "legacy.zip",
        url: "legacy.zip",
        sha512: "legacy",
        size: 200,
        entry: "mini-backend.exe",
      },
      "intel-openvino": {
        profile: "intel-openvino",
        version: "1.2.3",
        platform: "win32",
        arch: "x64",
        fileName: "openvino.zip",
        url: "openvino.zip",
        sha512: "openvino",
        size: 300,
        entry: "mini-backend.exe",
      },
    },
  };

  const options = listMiniBackendRuntimeArtifactOptions({
    manifest,
    recommendedProfile: "nvidia-cuda-legacy",
    installedProfiles: ["cpu", "nvidia-cuda-legacy"] as const,
  });

  assert.deepEqual(options, [
    {
      profile: "cpu",
      version: "1.2.3",
      size: 100,
      installed: true,
      recommended: false,
    },
    {
      profile: "nvidia-cuda-legacy",
      version: "1.2.3",
      size: 200,
      installed: true,
      recommended: true,
    },
    {
      profile: "intel-openvino",
      version: "1.2.3",
      size: 300,
      installed: false,
      recommended: false,
    },
  ]);
});
