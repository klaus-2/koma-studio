/**
 * Mini-backend runtime artifact manifest fetch + listing.
 */
import {
  listMiniBackendRuntimeArtifactOptions,
  type MiniBackendRuntimeArtifactManifest,
  type MiniBackendRuntimeArtifactOption,
  type MiniBackendRuntimeArtifactRecord,
} from "../mini-backend-artifacts.ts";
import type { MiniBackendAccelerationProfile } from "../mini-backend-runtime.ts";
import {
  runWithRetry,
  RUNTIME_DOWNLOAD_RETRY_COUNT,
} from "../mini-backend-runtime-download.ts";
import { isRetryableRuntimeDownloadError } from "./mini-backend-runtime-disk.ts";
import { isMiniBackendRuntimeInstalled } from "./mini-backend-runtime-integrity.ts";
import type { MiniBackendRuntimeStore } from "./mini-backend-runtime-store.ts";
import { resolveMiniBackendRuntimeManifestUrl } from "./mini-backend-runtime-urls.ts";

const createMiniBackendManifestReader = (deps: {
  runtimeStore: MiniBackendRuntimeStore;
  miniBackendArtifactsUrl: string | null;
  resolveAccelerationProfile: (options?: {
    silent?: boolean;
    ignoreManualSelection?: boolean;
  }) => Promise<MiniBackendAccelerationProfile>;
}) => {
  const readMiniBackendRuntimeManifest = async (
    { silent = false }: { silent?: boolean } = {},
  ): Promise<MiniBackendRuntimeArtifactManifest | null> => {
    const manifestUrl = resolveMiniBackendRuntimeManifestUrl(deps.miniBackendArtifactsUrl);
    if (!manifestUrl) {
      return null;
    }

    try {
      if (!silent) {
        deps.runtimeStore.patch({
          status: "checking",
          statusMessage: "Checking runtime artifact manifest.",
          runtimeManifestUrl: manifestUrl,
        });
      }
      const response = await runWithRetry({
        retryCount: RUNTIME_DOWNLOAD_RETRY_COUNT,
        isRetryable: isRetryableRuntimeDownloadError,
        onRetry: ({ attempt, delayMs, error }) => {
          if (!silent) {
            deps.runtimeStore.patch({
              status: "checking",
              statusMessage: `Retrying runtime manifest request (${attempt + 1}/${RUNTIME_DOWNLOAD_RETRY_COUNT + 1}) in ${Math.max(1, Math.ceil(delayMs / 1000))}s.`,
              lastError: error instanceof Error ? error.message : String(error),
              attempt: Math.min(RUNTIME_DOWNLOAD_RETRY_COUNT + 1, attempt + 1),
              maxAttempts: RUNTIME_DOWNLOAD_RETRY_COUNT + 1,
            });
          }
        },
        operation: () => fetch(manifestUrl, {
          method: "GET",
          signal: AbortSignal.timeout(30_000),
        }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      if (!payload || typeof payload !== "object") {
        throw new Error("Invalid runtime manifest payload");
      }

      return payload as MiniBackendRuntimeArtifactManifest;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!silent) {
        deps.runtimeStore.patch({
          status: "checking",
          statusMessage: "Checking runtime artifact manifest.",
          runtimeManifestUrl: manifestUrl,
          lastError: `Failed to read runtime manifest: ${message}`,
        });
      }
      return null;
    }
  };

  const listMiniBackendRuntimeArtifacts = async (): Promise<MiniBackendRuntimeArtifactOption[]> => {
    const manifest = await readMiniBackendRuntimeManifest({ silent: true });
    if (!manifest) {
      return [];
    }

    const recommendedProfile = await deps.resolveAccelerationProfile({
      silent: true,
      ignoreManualSelection: true,
    });
    const installedProfiles = Object.values(manifest.profiles)
      .filter((entry): entry is MiniBackendRuntimeArtifactRecord => Boolean(entry))
      .flatMap((entry) => (
        isMiniBackendRuntimeInstalled(manifest.version, entry.profile, entry.entry)
          ? [entry.profile]
          : []
      ));

    return listMiniBackendRuntimeArtifactOptions({
      manifest,
      recommendedProfile,
      installedProfiles,
    });
  };

  return { listMiniBackendRuntimeArtifacts, readMiniBackendRuntimeManifest };
};

export { createMiniBackendManifestReader };
