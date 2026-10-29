/**
 * GPU-specific provisioning rules the requirements files cannot express.
 *
 * Two failure modes motivated this module:
 *
 * 1. `onnxruntime` (CPU) and `onnxruntime-gpu` (GPU) share one package
 *    namespace. Installing one while the other is present silently replaces
 *    the shared `onnxruntime/` files, so a venv provisioned for a CUDA profile
 *    can import a CPU-only runtime and lose `CUDAExecutionProvider` without
 *    pip ever reporting a conflict. The conflicting variant has to be
 *    uninstalled and the pinned wheel force-reinstalled.
 * 2. PyPI's Windows torch wheels are CPU-only; CUDA builds live on the
 *    PyTorch wheel index. A CUDA-profile install that lets pip resolve
 *    `torch>=2.5.0` against PyPI on Windows bakes in a CPU torch.
 */

/** Profiles whose ONNX runtime must expose `CUDAExecutionProvider`. */
export const requiresNvidiaProviderProbe = (profile) =>
    typeof profile === "string" && profile.startsWith("nvidia-");

/**
 * The CUDA-provider assertion appended to the import probe for NVIDIA
 * profiles. Canonical copy: the Electron shell's probe
 * (apps/electron/scripts/mini-venv-probe.mjs) embeds the same snippet and a
 * parity test pins the two together.
 */
export const CUDA_PROVIDER_PROBE_SNIPPET = `
providers = onnxruntime.get_available_providers()
if "CUDAExecutionProvider" not in providers:
    raise SystemExit("onnxruntime has no CUDAExecutionProvider; providers: " + repr(providers))`;

/**
 * The ONNX Runtime requirement line a resolved requirements set pins, verbatim.
 *
 * The LAST match wins: `-r` includes are expanded before the profile file's
 * own lines, so a modern profile's `onnxruntime-gpu` pin always follows the
 * base set's CPU `onnxruntime` line. Taking the first match would read the
 * CPU pin as the profile's choice and the repair step would uninstall the
 * GPU wheel it is meant to protect.
 */
export const resolveOnnxruntimeRequirement = (lines) =>
    lines.findLast((entry) => /^onnxruntime(?:-gpu)?\b/i.test(entry)) ?? null;

/** `onnxruntime-gpu==1.18.1` → `"onnxruntime-gpu"`; unrecognized → null. */
export const onnxruntimeVariantOf = (requirement) => {
    // The lookahead keeps `onnxruntime-openvino` (a different distribution)
    // from matching as the `onnxruntime` variant.
    const match = /^(onnxruntime(?:-gpu)?)(?=[=<>!~\s]|$)/i.exec(requirement ?? "");
    return match ? match[1].toLowerCase() : null;
};

/** The ONNX Runtime distribution that must not be co-installed with *variant*. */
export const conflictingOnnxruntimeVariant = (variant) => {
    if (variant === "onnxruntime-gpu") return "onnxruntime";
    if (variant === "onnxruntime") return "onnxruntime-gpu";
    return null;
};

/** Drop the torch lines a Windows CUDA-profile install must not feed to PyPI. */
export const withoutTorchLines = (lines) =>
    lines.filter((entry) => !/^(torch|torchvision)\b/i.test(entry));

/** Maintained CUDA wheel index for torch on Windows (Pascal-era GPUs included). */
export const TORCH_CUDA_INDEX_URL = "https://download.pytorch.org/whl/cu124";
