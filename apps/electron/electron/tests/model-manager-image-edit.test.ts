import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { BACKEND_MANAGED_MODEL_IDS } from "../model-manager/constants.ts";
import { isInstalledPayloadPresent } from "../model-manager/installed-state.ts";

const LOCAL_IMAGE_EDIT_CASES: ReadonlyArray<{
  id: string;
  requiredFiles: ReadonlyArray<string>;
}> = [
  {
    id: "instruct_pix2pix",
    requiredFiles: [
      "model_index.json",
      "unet/diffusion_pytorch_model.fp16.safetensors",
      "vae/diffusion_pytorch_model.fp16.safetensors",
      "text_encoder/model.fp16.safetensors",
    ],
  },
  {
    id: "sdxl_instruct_pix2pix",
    requiredFiles: [
      "model_index.json",
      "unet/diffusion_pytorch_model.safetensors",
      "vae/diffusion_pytorch_model.safetensors",
      "text_encoder/model.safetensors",
      "text_encoder_2/model.safetensors",
    ],
  },
  {
    id: "flux2_klein_4b_gguf_q4",
    requiredFiles: [
      "model_index.json",
      "gguf/flux-2-klein-4b-Q4_K_M.gguf",
      "vae/diffusion_pytorch_model.safetensors",
      "text_encoder/model-00001-of-00002.safetensors",
      "text_encoder/model-00002-of-00002.safetensors",
    ],
  },
  {
    id: "flux2_klein_4b",
    requiredFiles: [
      "model_index.json",
      "transformer/diffusion_pytorch_model.safetensors",
      "vae/diffusion_pytorch_model.safetensors",
      "text_encoder/model-00001-of-00002.safetensors",
      "text_encoder/model-00002-of-00002.safetensors",
    ],
  },
  {
    id: "longcat_image_edit_turbo",
    requiredFiles: [
      "model_index.json",
      "transformer/diffusion_pytorch_model.safetensors",
      "vae/diffusion_pytorch_model.safetensors",
      "text_encoder/model-00001-of-00005.safetensors",
      "text_encoder/model-00005-of-00005.safetensors",
    ],
  },
  {
    id: "qwen_image_edit_2511_gguf_q4",
    requiredFiles: [
      "model_index.json",
      "gguf/qwen-image-edit-2511-Q4_K_M.gguf",
      "vae/diffusion_pytorch_model.safetensors",
      "text_encoder/model-00001-of-00004.safetensors",
      "text_encoder/model-00004-of-00004.safetensors",
    ],
  },
  {
    id: "qwen_image_edit_2511",
    requiredFiles: [
      "model_index.json",
      "transformer/diffusion_pytorch_model-00001-of-00005.safetensors",
      "transformer/diffusion_pytorch_model-00005-of-00005.safetensors",
      "vae/diffusion_pytorch_model.safetensors",
      "text_encoder/model-00001-of-00004.safetensors",
      "text_encoder/model-00004-of-00004.safetensors",
    ],
  },
  {
    id: "firered_image_edit_1_1",
    requiredFiles: [
      "model_index.json",
      "transformer/diffusion_pytorch_model-00001-of-00005.safetensors",
      "transformer/diffusion_pytorch_model-00005-of-00005.safetensors",
      "vae/diffusion_pytorch_model.safetensors",
      "text_encoder/model-00001-of-00004.safetensors",
      "text_encoder/model-00004-of-00004.safetensors",
    ],
  },
];

test("local HF image-edit models install through backend-managed path", () => {
  for (const spec of LOCAL_IMAGE_EDIT_CASES) {
    assert.ok(
      BACKEND_MANAGED_MODEL_IDS.has(spec.id),
      `${spec.id} must be registered in BACKEND_MANAGED_MODEL_IDS`,
    );
  }
});

test("local HF image-edit models verify full nested asset payloads", () => {
  for (const spec of LOCAL_IMAGE_EDIT_CASES) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), `koma-ie-${spec.id}-`));
    try {
      assert.equal(isInstalledPayloadPresent(spec.id, directory), false);

      fs.writeFileSync(path.join(directory, "model_index.json"), "{}");
      assert.equal(isInstalledPayloadPresent(spec.id, directory), false);

      for (const relPath of spec.requiredFiles) {
        const target = path.join(directory, relPath);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, "stub-weights");
      }
      assert.equal(isInstalledPayloadPresent(spec.id, directory), true);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
});
