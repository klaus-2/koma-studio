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
  exitCode: null,
  lastStderr: null,
  crashLogPath: null,
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

const ALL_RUNTIME_STATUSES: DesktopMiniBackendRuntimeState["status"][] = [
  "idle",
  "resolving",
  "checking",
  "downloading",
  "verifying",
  "extracting",
  "ready",
  "fallback",
  "starting",
  "error",
  "crashed",
];

test("only a settled runtime may announce that it is ready", () => {
  const notices = ALL_RUNTIME_STATUSES.map((status) =>
    buildRuntimeBannerToast(
      createRuntimeState({ status, source: "downloaded-runtime" }),
      true,
    )?.title,
  );

  assert.deepEqual(
    ALL_RUNTIME_STATUSES.filter((_, index) => notices[index] === "Runtime ready"),
    ["ready"],
  );
});

test("buildRuntimeBannerToast reports a crash with its attempt and post-mortem", () => {
  const toast = buildRuntimeBannerToast(
    createRuntimeState({
      status: "crashed",
      statusMessage: null,
      attempt: 2,
      maxAttempts: 5,
      crashLogPath: "C:/Users/koma/Logs/mini-backend-crash.log",
    }),
    false,
  );

  assert.deepEqual(toast, {
    title: "Local backend stopped",
    description:
      "The local AI backend stopped unexpectedly (attempt 2 of 5). " +
      "Post-mortem: C:/Users/koma/Logs/mini-backend-crash.log",
  });
});

test("buildRuntimeBannerToast prefers the shell crash message when present", () => {
  const toast = buildRuntimeBannerToast(
    createRuntimeState({
      status: "crashed",
      statusMessage: "Local backend exited unexpectedly (code -1); automatic recovery stopped.",
      attempt: 3,
      maxAttempts: 5,
    }),
    false,
  );

  assert.equal(toast?.description, "Local backend exited unexpectedly (code -1); automatic recovery stopped.");
});

test("buildRuntimeBannerToast stays silent while a restart is in flight", () => {
  assert.equal(
    buildRuntimeBannerToast(createRuntimeState({ status: "starting", source: "downloaded-runtime" }), true),
    null,
  );
});
