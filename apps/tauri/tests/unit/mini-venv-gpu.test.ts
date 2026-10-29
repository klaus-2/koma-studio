import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
    TORCH_CUDA_INDEX_URL,
    conflictingOnnxruntimeVariant,
    onnxruntimeVariantOf,
    requiresNvidiaProviderProbe,
    resolveOnnxruntimeRequirement,
    withoutTorchLines,
} from "../../scripts/lib/mini-venv-gpu.mjs";

const tauriRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("requiresNvidiaProviderProbe", () => {
    it("asserts the CUDA provider for every NVIDIA profile", () => {
        expect(requiresNvidiaProviderProbe("nvidia-cuda")).toBe(true);
        expect(requiresNvidiaProviderProbe("nvidia-cuda-legacy")).toBe(true);
        expect(requiresNvidiaProviderProbe("nvidia-tensorrt")).toBe(true);
    });

    it("leaves non-NVIDIA profiles alone", () => {
        expect(requiresNvidiaProviderProbe("cpu")).toBe(false);
        expect(requiresNvidiaProviderProbe("amd-rocm")).toBe(false);
        expect(requiresNvidiaProviderProbe("apple-mps")).toBe(false);
        expect(requiresNvidiaProviderProbe("")).toBe(false);
        expect(requiresNvidiaProviderProbe(undefined)).toBe(false);
    });
});

describe("resolveOnnxruntimeRequirement", () => {
    it("finds the pinned GPU wheel among the requirement lines", () => {
        const lines = [
            "fastapi==0.115.0",
            "onnxruntime-gpu==1.18.1",
            "nvidia-cudnn-cu11==8.9.5.29",
        ];
        expect(resolveOnnxruntimeRequirement(lines)).toBe("onnxruntime-gpu==1.18.1");
    });

    it("finds the pinned CPU wheel", () => {
        const lines = ["onnxruntime==1.22.1", "torch>=2.5.0"];
        expect(resolveOnnxruntimeRequirement(lines)).toBe("onnxruntime==1.22.1");
    });

    it("lets the profile file's own pin beat the base set's CPU pin", () => {
        // Expansion order for a modern profile: `-r requirements.txt` (CPU
        // onnxruntime) first, then the profile's own onnxruntime-gpu line.
        const lines = [
            "fastapi==0.115.0",
            "onnxruntime==1.22.1",
            "onnxruntime-gpu==1.22.0",
            "nvidia-cuda-runtime-cu12",
        ];
        expect(resolveOnnxruntimeRequirement(lines)).toBe("onnxruntime-gpu==1.22.0");
    });

    it("returns null when no ONNX runtime is pinned", () => {
        expect(resolveOnnxruntimeRequirement(["torch>=2.5.0"])).toBeNull();
        expect(resolveOnnxruntimeRequirement([])).toBeNull();
    });
});

describe("onnxruntimeVariantOf", () => {
    it("reads the variant out of a pinned requirement", () => {
        expect(onnxruntimeVariantOf("onnxruntime-gpu==1.18.1")).toBe("onnxruntime-gpu");
        expect(onnxruntimeVariantOf("onnxruntime==1.22.1")).toBe("onnxruntime");
    });

    it("rejects requirements that are not ONNX Runtime", () => {
        expect(onnxruntimeVariantOf("onnxruntime-something==1.0.0")).toBeNull();
        expect(onnxruntimeVariantOf("onnxruntime-openvino==1.22.0")).toBeNull();
        expect(onnxruntimeVariantOf(null)).toBeNull();
    });
});

describe("conflictingOnnxruntimeVariant", () => {
    it("names the CPU package as the conflict of a GPU profile", () => {
        expect(conflictingOnnxruntimeVariant("onnxruntime-gpu")).toBe("onnxruntime");
    });

    it("names the GPU package as the conflict of a CPU profile", () => {
        expect(conflictingOnnxruntimeVariant("onnxruntime")).toBe("onnxruntime-gpu");
    });

    it("returns null for an unknown variant", () => {
        expect(conflictingOnnxruntimeVariant("onnxruntime-openvino")).toBeNull();
    });
});

describe("withoutTorchLines", () => {
    it("drops torch and torchvision but keeps everything else", () => {
        const lines = [
            "torch>=2.5.0",
            "torchvision>=0.20.0",
            "transformers>=4.50.0",
            "psutil>=5.9.0",
        ];
        expect(withoutTorchLines(lines)).toEqual(["transformers>=4.50.0", "psutil>=5.9.0"]);
    });

    it("does not drop packages whose name merely starts with torch", () => {
        expect(withoutTorchLines(["torchao==0.1.0"])).toEqual(["torchao==0.1.0"]);
    });
});

describe("TORCH_CUDA_INDEX_URL", () => {
    it("points at the PyTorch CUDA wheel index", () => {
        expect(TORCH_CUDA_INDEX_URL).toBe("https://download.pytorch.org/whl/cu124");
    });

    it("matches the backend provisioner's index (single source of truth)", () => {
        const source = fs.readFileSync(
            path.join(tauriRoot, "..", "..", "packages", "mini-backend", "mini_backend_tools", "torch_wheels.py"),
            "utf8",
        );
        const match = source.match(/TORCH_CUDA_INDEX_URL = "([^"]+)"/);
        expect(match?.[1]).toBe(TORCH_CUDA_INDEX_URL);
    });
});
