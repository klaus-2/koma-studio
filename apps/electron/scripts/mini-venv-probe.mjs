// Verifies a mini-backend venv can actually import the core dependencies.
// Mirrors the Tauri shell's runImportQuery (apps/tauri/scripts/lib/mini-venv-verdict.mjs
// plus the profile rules in apps/tauri/scripts/lib/mini-venv-gpu.mjs)
// but with the Electron module list and cv2.imencode attribute probe.

export const QUERY_MODULES = ["fastapi", "onnxruntime", "torch", "cv2"];

export const QUERY_PROBE =
  "if not hasattr(cv2, 'imencode'):\n    raise SystemExit('cv2 has no native module')";

export const QUERY_TIMEOUT_MS = 120_000;

/**
 * NVIDIA profiles require `CUDAExecutionProvider`: onnxruntime (CPU) and
 * onnxruntime-gpu share one package namespace, so a venv can import a
 * CPU-only runtime while its GPU dist-info still looks installed — the exact
 * state that silently strips the CUDA provider from a CUDA-profile venv.
 */
export const requiresNvidiaProviderProbe = (profile) =>
  typeof profile === "string" && profile.startsWith("nvidia-");

export const buildQueryProbe = (profile) => {
  if (!requiresNvidiaProviderProbe(profile)) {
    return QUERY_PROBE;
  }
  return `${QUERY_PROBE}
providers = onnxruntime.get_available_providers()
if "CUDAExecutionProvider" not in providers:
    raise SystemExit("onnxruntime has no CUDAExecutionProvider; providers: " + repr(providers))`;
};

const MAX_STDERR_CHARS = 4096;

const outputTail = (data) => {
  const text = (data ?? "").toString().replace(/\r\n/g, "\n").trim();
  if (text === "") return "<no output captured>";
  return text.slice(-MAX_STDERR_CHARS).replace(/\n/g, "\u23CE");
};

/**
 * Run a quick Python import query against the venv interpreter.
 *
 * @param {string} pythonPath  Absolute path to the venv's python binary.
 * @param {Function} spawnSync The child_process.spawnSync to use (injected for testing).
 * @param {string} [profile]   Active acceleration profile; NVIDIA profiles
 *                             also assert the CUDA execution provider.
 * @returns {{ ok: boolean, errored: boolean, status: number|null, stderrTail: string }}
 */
export const queryVenv = (pythonPath, spawnSync, profile = "") => {
  const source = `import ${QUERY_MODULES.join(", ")}\n${buildQueryProbe(profile)}`;
  const result = spawnSync(pythonPath, ["-c", source], {
    stdio: ["ignore", "pipe", "pipe"],
    timeout: QUERY_TIMEOUT_MS,
  });
  return {
    ok: !result.error && result.status === 0,
    errored: Boolean(result.error),
    status: result.status ?? null,
    stderrTail: outputTail(result.stderr),
  };
};
