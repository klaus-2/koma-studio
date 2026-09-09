// Pure helpers for scripts/build-mini-backend.mjs: acceleration-profile
// selection (CLI arg > env var > interactive prompt > cpu fallback) and the
// incremental-build skip decision. Side-effect free so tests can cover them.
export const parseProfileFromArgs = (argv) => {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg.startsWith("--profile=")) {
      return arg.slice("--profile=".length).trim() || null;
    }
    if (arg === "--profile" && index + 1 < argv.length) {
      return argv[index + 1].trim() || null;
    }
  }
  return null;
};

export const hasForceRebuildFlag = (argv) => argv.includes("--force");

export const isTruthyEnvFlag = (value) =>
  ["1", "true", "yes"].includes(String(value ?? "").trim().toLowerCase());

// Priority: explicit --profile wins over MINI_BACKEND_ACCELERATION_PROFILE
// (CI pipelines set the env var; a human typing the flag is more specific).
export const resolveRequestedProfile = ({ argv, envProfile }) => {
  const fromArgs = parseProfileFromArgs(argv);
  if (fromArgs) {
    return { profile: fromArgs.toLowerCase(), source: "arg" };
  }

  const fromEnv = String(envProfile ?? "").trim();
  if (fromEnv) {
    return { profile: fromEnv.toLowerCase(), source: "env" };
  }

  return { profile: null, source: null };
};

export const detectRecommendedProfile = ({
  platform,
  arch,
  commandExists,
}) => {
  if (platform === "darwin") {
    return arch === "arm64" ? "apple-mps" : "cpu";
  }

  if (platform === "win32" || platform === "linux") {
    return commandExists("nvidia-smi") ? "nvidia-cuda" : "cpu";
  }

  return "cpu";
};

// Mirrors _PROFILE_ONNX_PACKAGE in scripts/ensure-mini-deps.py. The venv can
// drift from the marker when the backend's DLL auto-repair installs a
// GPU-profile variant straight through ensure-mini-deps.py (no marker write).
export const expectedOnnxPackageForProfile = (profile) =>
  ({
    cpu: "onnxruntime",
    "apple-mps": "onnxruntime",
    "nvidia-cuda": "onnxruntime-gpu",
    "nvidia-cuda-legacy": "onnxruntime-gpu",
    "nvidia-tensorrt": "onnxruntime-gpu",
    "intel-openvino": "onnxruntime-openvino",
    "amd-rocm": "onnxruntime-rocm",
  })[profile] ?? "onnxruntime";

export const ONNX_RUNTIME_VARIANTS = [
  "onnxruntime",
  "onnxruntime-gpu",
  "onnxruntime-directml",
  "onnxruntime-openvino",
  "onnxruntime-rocm",
];

// ponytail: cache only covers the default source dir; hardened/artifact
// pipelines override MINI_BACKEND_SOURCE_DIR and manage their own caching.
export const shouldSkipMiniBackendBuild = ({
  forceRebuild,
  customSourceDir,
  cachedHash,
  currentHash,
  distArtifactExists,
}) =>
  !forceRebuild &&
  !customSourceDir &&
  Boolean(currentHash) &&
  cachedHash === currentHash &&
  distArtifactExists;
