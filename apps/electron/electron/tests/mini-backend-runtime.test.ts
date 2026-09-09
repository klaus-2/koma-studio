import test from "node:test";
import assert from "node:assert/strict";

import {
  buildManualInstallBlockedState,
  extractGpuVendors,
  extractGpuVendorsFromWindowsVideoControllers,
  formatRuntimeFallbackReason,
  resolveEffectiveAccelerationProfile,
  resolveAccelerationProfile,
  resolveManifestEntry,
  type MiniBackendLaunchManifest,
} from "../mini-backend-runtime.ts";

test("resolveAccelerationProfile prefers Nvidia on Windows", () => {
  const profile = resolveAccelerationProfile({
    platform: "win32",
    arch: "x64",
    overrideProfile: "auto",
    gpuVendors: ["NVIDIA", "Intel"],
  });

  assert.equal(profile, "nvidia-cuda");
});

test("resolveAccelerationProfile routes legacy Pascal Nvidia GPUs to legacy profile", () => {
  const profile = resolveAccelerationProfile({
    platform: "win32",
    arch: "x64",
    overrideProfile: "auto",
    gpuVendors: ["NVIDIA", "NVIDIA GeForce GTX 1050 Ti"],
  });

  assert.equal(profile, "nvidia-cuda-legacy");
});

test("resolveAccelerationProfile prefers Apple Silicon on arm64 macOS", () => {
  const profile = resolveAccelerationProfile({
    platform: "darwin",
    arch: "arm64",
    overrideProfile: "auto",
    gpuVendors: [],
  });

  assert.equal(profile, "apple-mps");
});

test("resolveAccelerationProfile resolves AMD ROCm on Linux", () => {
  const profile = resolveAccelerationProfile({
    platform: "linux",
    arch: "x64",
    overrideProfile: "auto",
    gpuVendors: ["Advanced Micro Devices, Inc."],
  });

  assert.equal(profile, "amd-rocm");
});

test("resolveAccelerationProfile honors explicit override", () => {
  const profile = resolveAccelerationProfile({
    platform: "win32",
    arch: "x64",
    overrideProfile: "intel-openvino",
    gpuVendors: ["NVIDIA"],
  });

  assert.equal(profile, "intel-openvino");
});

test("extractGpuVendors includes vendor and device name descriptors", () => {
  const descriptors = extractGpuVendors({
    gpuDevice: [
      {
        vendor: "NVIDIA",
        deviceName: "NVIDIA GeForce GTX 1050 Ti",
      },
    ],
  });

  assert.deepEqual(descriptors, ["NVIDIA", "NVIDIA GeForce GTX 1050 Ti"]);
});

test("extractGpuVendors reads Electron complete GPUInfo fields and resolves legacy Nvidia correctly", () => {
  const descriptors = extractGpuVendors({
    gpuDevice: [
      {
        vendorId: 0x10de,
        deviceId: 0x1c82,
        vendorString: "NVIDIA Corporation",
        deviceString: "NVIDIA GeForce GTX 1050 Ti/PCIe/SSE2",
      },
    ],
    auxAttributes: {
      glRenderer: "ANGLE (NVIDIA GeForce GTX 1050 Ti Direct3D11 vs_5_0 ps_5_0)",
      glVendor: "Google Inc. (NVIDIA)",
    },
  });

  assert.ok(descriptors.some((value) => /nvidia/i.test(value)));
  assert.ok(descriptors.some((value) => /1050\s*ti/i.test(value)));

  const profile = resolveAccelerationProfile({
    platform: "win32",
    arch: "x64",
    overrideProfile: "auto",
    gpuVendors: descriptors,
  });

  assert.equal(profile, "nvidia-cuda-legacy");
});

test("extractGpuVendorsFromWindowsVideoControllers parses PowerShell device inventory", () => {
  const descriptors = extractGpuVendorsFromWindowsVideoControllers([
    {
      Name: "NVIDIA GeForce GTX 1050 Ti",
      AdapterCompatibility: "NVIDIA",
      PNPDeviceID: "PCI\\VEN_10DE&DEV_1C82&SUBSYS_37271458",
    },
    {
      Name: "Intel(R) UHD Graphics 630",
      AdapterCompatibility: "Intel Corporation",
      PNPDeviceID: "PCI\\VEN_8086&DEV_3E92&SUBSYS_3E921849",
    },
  ]);

  assert.ok(descriptors.includes("NVIDIA GeForce GTX 1050 Ti"));
  assert.ok(descriptors.includes("NVIDIA"));
  assert.ok(descriptors.includes("Intel(R) UHD Graphics 630"));
});

test("buildManualInstallBlockedState resets progress state when download is skipped", () => {
  const nextState = buildManualInstallBlockedState({
    reason: "cpu-not-required",
    requestedProfile: "cpu",
    activeProfile: "cpu",
    source: "bundled-core",
  });

  assert.equal(nextState.status, "ready");
  assert.equal(nextState.lastError, null);
  assert.equal(nextState.progress, null);
  assert.equal(nextState.attempt, 0);
  assert.equal(nextState.maxAttempts, 0);
  assert.match(nextState.statusMessage, /does not need a downloadable gpu runtime profile/i);
});

test("resolveEffectiveAccelerationProfile downgrades legacy cuda to cpu when provider fell back to CPU", () => {
  const effectiveProfile = resolveEffectiveAccelerationProfile({
    requestedProfile: "nvidia-cuda-legacy",
    provider: "CPUExecutionProvider",
  });

  assert.equal(effectiveProfile, "cpu");
});

test("resolveEffectiveAccelerationProfile downgrades TensorRT requests to CUDA when CUDA is the effective provider", () => {
  const effectiveProfile = resolveEffectiveAccelerationProfile({
    requestedProfile: "nvidia-tensorrt",
    provider: "CUDAExecutionProvider",
  });

  assert.equal(effectiveProfile, "nvidia-cuda");
});

test("formatRuntimeFallbackReason humanizes known provider fallback codes", () => {
  const cudaLegacyReason = formatRuntimeFallbackReason("onnx_cuda_legacy_provider_unavailable");
  const warmupFallbackReason = formatRuntimeFallbackReason("runtime_warmup_fallback_to_cpu");

  assert.ok(cudaLegacyReason);
  assert.ok(warmupFallbackReason);
  assert.match(
    cudaLegacyReason,
    /cuda legacy runtime is unavailable/i,
  );
  assert.match(
    warmupFallbackReason,
    /downgraded to cpu/i,
  );
});

test("resolveManifestEntry returns the profile-specific command info", () => {
  const manifest: MiniBackendLaunchManifest = {
    schemaVersion: 1,
    platform: "win32",
    arch: "x64",
    defaultProfile: "cpu",
    profiles: {
      cpu: {
        entry: "mini-backend.exe",
        env: {
          MINI_BACKEND_ACCELERATION_PROFILE: "cpu",
        },
      },
      "nvidia-cuda": {
        entry: "mini-backend.exe",
        env: {
          MINI_BACKEND_ACCELERATION_PROFILE: "nvidia-cuda",
        },
      },
    },
  };

  const entry = resolveManifestEntry(manifest, "nvidia-cuda");
  assert.equal(entry.profile, "nvidia-cuda");
  assert.equal(entry.entry, "mini-backend.exe");
  assert.equal(entry.env.MINI_BACKEND_ACCELERATION_PROFILE, "nvidia-cuda");
});

test("resolveManifestEntry falls back to default profile when requested profile is missing", () => {
  const manifest: MiniBackendLaunchManifest = {
    schemaVersion: 1,
    platform: "linux",
    arch: "x64",
    defaultProfile: "cpu",
    profiles: {
      cpu: {
        entry: "mini-backend",
        env: {
          MINI_BACKEND_ACCELERATION_PROFILE: "cpu",
        },
      },
    },
  };

  const entry = resolveManifestEntry(manifest, "amd-rocm");
  assert.equal(entry.profile, "cpu");
  assert.equal(entry.entry, "mini-backend");
});
