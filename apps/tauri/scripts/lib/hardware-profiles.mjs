/**
 * Single source of truth for the hardware acceleration profiles the build
 * pipeline can bake into a mini-backend sidecar.
 *
 * A "profile" is a hardware acceleration target (CPU, NVIDIA CUDA, AMD ROCm,
 * ...). Each one needs a different set of Python wheels — `onnxruntime-gpu`
 * plus the `nvidia-*` CUDA runtime packages, `onnxruntime-rocm`,
 * `onnxruntime-openvino`, ... — and those sets are already declared in the
 * per-platform requirements files next to `mini-backend/requirements.txt`.
 * Every one of those files starts with `-r requirements.txt`, so a profile
 * install is always "the base set plus the profile's native wheels", never a
 * separate parallel dependency tree.
 *
 * This mirrors `PROFILE_REQUIREMENTS` in `packages/mini-backend/scripts/ensure-mini-deps.py`, which
 * performs the same resolution at runtime when the backend finds its native
 * libraries missing. The two maps are kept in sync by
 * `tests/unit/hardware-profiles.test.ts`, which parses the Python source and
 * asserts entry-for-entry equality — so adding a profile in one place and
 * forgetting the other fails the test suite instead of shipping a broken
 * installer.
 */
/** Profile used when the operator makes no choice. Matches the base file. */
export const DEFAULT_PROFILE = "cpu";
/**
 * Profiles that need no wheels beyond `mini-backend/requirements.txt`.
 *
 * `apple-mps` is in the requirements map (it has its own file) but that file
 * is currently just `-r requirements.txt`: PyTorch ships Metal support in the
 * default macOS wheel, so there is nothing extra to install. It is listed here
 * anyway because resolution must still succeed for it.
 */
const BASE_REQUIREMENTS_FILE = "requirements.txt";
/**
 * Platform keys used across this module. They match the `--platform` values
 * accepted by `scripts/build-hardened-release.mjs` rather than Node's
 * `process.platform`, because that is what an operator types.
 */
export const PLATFORM_KEYS = Object.freeze(["win", "mac", "linux"]);
/**
 * Translate a Node `process.platform` value into a platform key.
 * Unknown platforms are returned verbatim so callers can report them.
 */
export const platformKeyFromNodePlatform = (nodePlatform) => {
    if (nodePlatform === "win32") return "win";
    if (nodePlatform === "darwin") return "mac";
    return nodePlatform;
};
/**
 * Translate a platform key into the `platform.system()` value that
 * `packages/mini-backend/scripts/ensure-mini-deps.py` keys its map on. Used by the parity test.
 */
export const pythonSystemNameFor = (platformKey) => {
    if (platformKey === "win") return "Windows";
    if (platformKey === "mac") return "Darwin";
    if (platformKey === "linux") return "Linux";
    return null;
};
/**
 * The catalog, in the order an interactive prompt should present it.
 *
 * `requirements` maps a platform key to the file, relative to `mini-backend/`,
 * that installs the profile on that platform. A platform absent from the map
 * cannot build that profile — the prompt hides it and `--profile` rejects it.
 */
export const HARDWARE_PROFILES = Object.freeze([
    Object.freeze({
        id: "cpu",
        label: "CPU only",
        summary: "Portable build. Runs anywhere, no GPU drivers required.",
        requirements: Object.freeze({
            win: BASE_REQUIREMENTS_FILE,
            mac: BASE_REQUIREMENTS_FILE,
            linux: BASE_REQUIREMENTS_FILE,
        }),
    }),
    Object.freeze({
        id: "nvidia-cuda",
        label: "NVIDIA CUDA",
        summary: "onnxruntime-gpu + the CUDA 12 runtime. Turing (RTX 20xx) and newer.",
        requirements: Object.freeze({
            win: "requirements-windows-nvidia.txt",
            linux: "requirements-linux-nvidia.txt",
        }),
    }),
    Object.freeze({
        id: "nvidia-cuda-legacy",
        label: "NVIDIA CUDA (legacy GPUs)",
        summary: "Same CUDA 12 stack, tuned for Pascal-era cards (GTX 10xx).",
        requirements: Object.freeze({
            win: "requirements-windows-nvidia-legacy.txt",
            // Linux has no separate legacy stack: the difference between the primary
            // and legacy NVIDIA profiles is provider configuration, not packages.
            linux: "requirements-linux-nvidia.txt",
        }),
    }),
    Object.freeze({
        id: "nvidia-tensorrt",
        label: "NVIDIA TensorRT",
        summary: "CUDA stack with the TensorRT execution provider enabled.",
        requirements: Object.freeze({
            win: "requirements-windows-nvidia.txt",
            linux: "requirements-linux-nvidia.txt",
        }),
    }),
    Object.freeze({
        id: "amd-rocm",
        label: "AMD ROCm",
        summary: "onnxruntime-rocm. Linux only — ROCm has no Windows build.",
        requirements: Object.freeze({
            linux: "requirements-linux-amd.txt",
        }),
    }),
    Object.freeze({
        id: "intel-openvino",
        label: "Intel OpenVINO",
        summary: "onnxruntime-openvino for Intel iGPUs, NPUs, and CPUs.",
        requirements: Object.freeze({
            win: "requirements-windows-intel.txt",
            linux: "requirements-linux-intel.txt",
        }),
    }),
    Object.freeze({
        id: "apple-mps",
        label: "Apple Metal (MPS)",
        summary: "Apple Silicon. Metal support ships in the default PyTorch wheel.",
        requirements: Object.freeze({
            mac: "requirements-macos-apple-silicon.txt",
        }),
    }),
]);
/** Every known profile id, for error messages and validation. */
export const PROFILE_IDS = Object.freeze(HARDWARE_PROFILES.map((profile) => profile.id));
/**
 * Lowercase and trim a raw profile string. Returns `null` for empty input so
 * callers can distinguish "not specified" from "specified as nonsense".
 */
export const normalizeProfile = (value) => {
    const normalized = String(value ?? "").trim().toLowerCase();
    return normalized === "" ? null : normalized;
};
/** Look a profile up by id. Returns `null` when the id is unknown. */
export const findProfile = (profileId) =>
    HARDWARE_PROFILES.find((profile) => profile.id === normalizeProfile(profileId)) ?? null;
/** The profiles that can actually be built on *platformKey*, in prompt order. */
export const profilesForPlatform = (platformKey) =>
    HARDWARE_PROFILES.filter((profile) => Boolean(profile.requirements[platformKey]));
/**
 * Resolve *profileId* on *platformKey* to the requirements file that installs
 * it, relative to `mini-backend/`.
 *
 * Throws rather than falling back to the base file on purpose: silently
 * building a CPU sidecar after the operator asked for CUDA is exactly the
 * failure this pipeline exists to prevent.
 */
export const resolveProfileRequirements = (profileId, platformKey) => {
    const normalized = normalizeProfile(profileId) ?? DEFAULT_PROFILE;
    const profile = findProfile(normalized);
    if (!profile) {
        throw new Error(
            `Unknown hardware profile "${normalized}". Known profiles: ${PROFILE_IDS.join(", ")}.`,
        );
    }
    const relativePath = profile.requirements[platformKey];
    if (!relativePath) {
        const supported = PLATFORM_KEYS.filter((key) => profile.requirements[key]);
        throw new Error(
            `Hardware profile "${normalized}" is not available on "${platformKey}". ` +
            `It builds on: ${supported.join(", ") || "no platform"}.`,
        );
    }
    return { profile: normalized, platformKey, relativePath };
};