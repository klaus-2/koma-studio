/**
 * Mini-backend command spec builder (dev Python vs packaged/downloaded).
 */
import { app } from "electron";
import path from "node:path";
import {
  resolveManifestEntry,
  type MiniBackendAccelerationProfile,
} from "../mini-backend-runtime.ts";
import {
  readMiniBackendRuntimeSelection,
  resolveSelectedRuntimeBinaryPath,
} from "../mini-backend-runtime-selection.ts";
import type { CommandSpec, MiniBackendCommandSpec } from "./mini-backend-packaged.ts";
import {
  readPackagedMiniBackendManifest,
  resolvePackagedMiniBackendBinary,
} from "./mini-backend-packaged.ts";
import { resolveDevPythonRuntime } from "./mini-backend-dev-runtime.ts";
import type { MiniBackendRuntimeStore } from "./mini-backend-runtime-store.ts";
import { resolveMiniBackendRuntimeManifestUrl } from "./mini-backend-runtime-urls.ts";

const createMiniBackendCommandBuilder = (deps: {
  isDev: boolean;
  runtimeStore: MiniBackendRuntimeStore;
  miniBackendArtifactsUrl: string | null;
  resolveAccelerationProfile: () => Promise<MiniBackendAccelerationProfile>;
}) => {
  const getMiniBackendCommand = async (): Promise<MiniBackendCommandSpec> => {
    const profile = await deps.resolveAccelerationProfile();
    if (deps.isDev) {
      const runtime = resolveDevPythonRuntime(profile);
      // monorepo: the mini-backend source lives in packages/mini-backend
      const miniBackendDir = path.join(process.cwd(), "..", "..", "packages", "mini-backend");
      const appPath = path.join(miniBackendDir, "app.py");
      deps.runtimeStore.patch({
        requestedProfile: profile,
        activeProfile: profile,
        source: "bundled-core",
        installDir: miniBackendDir,
        version: app.getVersion(),
        lastError: null,
        status: "checking",
        statusMessage: "Starting local development runtime.",
        attempt: 0,
        maxAttempts: 0,
        progress: null,
      });
      const dependencyCheck: CommandSpec = {
        command: runtime.command,
        args: [...runtime.args, "-c", "import psd_tools, photoshop"],
        cwd: miniBackendDir,
      };
      const dependencyInstall: CommandSpec = {
        command: runtime.command,
        args: [
          ...runtime.args,
          "-m",
          "pip",
          "install",
          "psd-tools>=1.12.0",
          "photoshop-python-api>=0.24.1",
          "pywin32>=306",
        ],
        cwd: miniBackendDir,
      };

      return {
        command: runtime.command,
        args: [...runtime.args, appPath],
        cwd: process.cwd(),
        dependencyCheck,
        dependencyInstall,
        env: {
          MINI_BACKEND_ACCELERATION_PROFILE: profile,
          // DEV: same env contract as the production spawn — without it the
          // backend runs blind (no models/reference images) and the profile
          // warmup fails.
          KOMA_MODELS_ROOT: path.join(app.getPath("userData"), "models"),
          KOMA_APP_RESOURCES_DIR: path.join(process.cwd(), "resources"),
          KOMA_REFERENCE_IMAGES_DIR: path.join(process.cwd(), "resources", "reference_images"),
        },
        runtimeSource: "bundled-core",
        installDir: miniBackendDir,
        version: app.getVersion(),
      };
    }

    const manifest = readPackagedMiniBackendManifest();
    const selectedRuntime = readMiniBackendRuntimeSelection(app.getPath("userData"));
    const selectedRuntimeBinaryPath = resolveSelectedRuntimeBinaryPath(app.getPath("userData"));
    if (selectedRuntime && selectedRuntime.profile === profile && selectedRuntimeBinaryPath) {
      return {
        command: selectedRuntimeBinaryPath,
        args: [],
        cwd: path.dirname(selectedRuntimeBinaryPath),
        env: {
          MINI_BACKEND_ACCELERATION_PROFILE: profile,
        },
        runtimeSource: "downloaded-runtime",
        installDir: path.dirname(selectedRuntimeBinaryPath),
        version: selectedRuntime.version,
      };
    }

    const manifestEntry = manifest ? resolveManifestEntry(manifest, profile) : null;
    const binaryPath = resolvePackagedMiniBackendBinary(manifestEntry?.entry);
    deps.runtimeStore.patch({
      requestedProfile: profile,
      activeProfile: manifestEntry?.profile ?? "cpu",
      source: "bundled-core",
      runtimeManifestUrl: resolveMiniBackendRuntimeManifestUrl(deps.miniBackendArtifactsUrl),
      runtimeArchiveUrl: null,
      installDir: path.dirname(binaryPath),
      version: app.getVersion(),
      lastError: deps.runtimeStore.getState().lastError,
      status:
        deps.runtimeStore.getState().lastError || (manifestEntry?.profile ?? "cpu") !== profile
          ? "fallback"
          : "ready",
      statusMessage:
        deps.runtimeStore.getState().lastError || (manifestEntry?.profile ?? "cpu") !== profile
          ? "Running with embedded fallback runtime."
          : "Embedded runtime ready.",
      attempt: 0,
      maxAttempts: 0,
      progress: null,
    });
    return {
      command: binaryPath,
      args: [],
      cwd: path.dirname(binaryPath),
      env: {
        MINI_BACKEND_ACCELERATION_PROFILE: manifestEntry?.env.MINI_BACKEND_ACCELERATION_PROFILE ?? profile,
        ...manifestEntry?.env,
      },
      runtimeSource: "bundled-core",
      installDir: path.dirname(binaryPath),
      version: app.getVersion(),
    };
  };

  return { getMiniBackendCommand };
};

export { createMiniBackendCommandBuilder };
