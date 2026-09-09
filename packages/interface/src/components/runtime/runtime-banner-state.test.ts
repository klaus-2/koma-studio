import { test } from "vitest";
import assert from "node:assert/strict";

import { buildRuntimeBannerToast } from "./runtime-banner-state.ts";
import type { DesktopMiniBackendRuntimeState } from "../../types";

const createRuntimeState = (
  patch: Partial<DesktopMiniBackendRuntimeState>,
): DesktopMiniBackendRuntimeState => ({
  status: "idle",
  statusMessage: null,
  downloadCacheDir: null,
  requestedProfile: "cpu",
  activeProfile: "cpu",
  source: "bundled-core",
  runtimeArtifactsUrl: null,
  runtimeManifestUrl: null,
  runtimeArchiveUrl: null,
  installDir: null,
  version: null,
  lastError: null,
  attempt: 0,
  maxAttempts: 0,
  progress: null,
  updatedAt: Date.now(),
  gpuName: null,
  vramGb: null,
  ...patch,
});

test("buildRuntimeBannerToast suppresses fallback banners", () => {
  const toast = buildRuntimeBannerToast(
    createRuntimeState({
      status: "fallback",
      requestedProfile: "nvidia-cuda-legacy",
      activeProfile: "cpu",
      lastError: "onnx_cuda_legacy_provider_unavailable",
    }),
    false,
  );

  assert.equal(toast, null);
});

test("buildRuntimeBannerToast keeps hard runtime errors visible", () => {
  const toast = buildRuntimeBannerToast(
    createRuntimeState({
      status: "error",
      lastError: "spawn failed",
    }),
    false,
  );

  assert.deepEqual(toast, {
    title: "Runtime startup failed",
    description: "spawn failed",
  });
});
