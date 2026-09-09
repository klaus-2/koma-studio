import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const runtimeRequirementsPath = (fileName) => path.join(
  process.cwd(),
  "..", "..", "packages", "mini-backend",
  fileName,
);

const normalizedRequirements = (fileName) =>
  fs.readFileSync(runtimeRequirementsPath(fileName), "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

// The legacy profile (Pascal, CC 6.1) can no longer follow the CUDA 12 stack
// used by the modern NVIDIA profile: cuDNN 9 dropped Pascal, and ORT ≥ 1.19
// (CUDA 12) requires cuDNN 9. The correct stack is the last CUDA 11.8 + cuDNN 8:
// onnxruntime-gpu 1.18.1 + cu11 wheels + numpy<2 (built against the 1.x C-API).
// Verified on a GTX 1050 Ti.
test("legacy NVIDIA requirements pin the last CUDA 11.8 + cuDNN 8 stack for Pascal", () => {
  const joined = normalizedRequirements("requirements-windows-nvidia-legacy.txt")
    .join("\n");

  assert.match(joined, /onnxruntime-gpu==1\.18\.1/);
  assert.match(joined, /nvidia-cuda-runtime-cu11==11\.8\.89/);
  // the numpy<2 ceiling lives in the included base file (ORT 1.18.1 × NumPy 1.x)
  const base = normalizedRequirements("requirements-base-no-ort.txt").join("\n");
  assert.match(base, /numpy>=1\.26\.0,<2/);
  assert.match(base, /scipy==1\.13\.1/);
  assert.doesNotMatch(base, /^onnxruntime/m);
  assert.match(joined, /nvidia-cudnn-cu11==8\.9\.5\.29/);
  assert.match(joined, /-r requirements-base-no-ort\.txt/);
});

test("legacy requirements never co-install the CUDA 12 stack", () => {
  const joined = normalizedRequirements("requirements-windows-nvidia-legacy.txt")
    .filter((line) => !line.startsWith("-r"))
    .join("\n");

  // The included base (base-no-ort) has no ONNX Runtime; the profile must
  // bring neither the CPU variant (onnxruntime) nor the cu12 stack
  // (incompatible with the ORT 1.18.1 of CUDA 11.8).
  assert.doesNotMatch(joined, /onnxruntime==/);
  assert.doesNotMatch(joined, /onnxruntime-gpu==1\.22/);
  assert.doesNotMatch(joined, /cu12/);
});
