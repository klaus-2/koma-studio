export const UNTESTED_MODEL_KEYS: ReadonlySet<string> = new Set<string>([
  "got_ocr2",
  "qwen2_5_vl_3b",
  "glm_ocr_onnx",
  "paddleocr_vl_1_5",
  "paddleocr_vl_manga",
  "mangalmm",
  "rolmocr",
  "sakura_galtransl_7b_v3_7",
  "sdxl_instruct_pix2pix",
  "flux2_klein_4b_gguf_q4",
  "flux2_klein_4b",
  "longcat_image_edit_turbo",
  "qwen_image_edit_2511_gguf_q4",
  "qwen_image_edit_2511",
  "firered_image_edit_1_1",
]);

export const TESTED_MODEL_KEYS: ReadonlySet<string> = new Set<string>([]);

export function isUntestedModel(key: string): boolean {
  return UNTESTED_MODEL_KEYS.has(key);
}
