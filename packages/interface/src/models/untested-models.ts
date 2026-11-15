/**
 * Maintainer-curated validation flags for heavy models.
 *
 * Single source of truth: cards and catalogs derive the "not tested" flag
 * from here via `isUntestedModel` — no booleans scattered across catalog
 * files. Keys listed here ship declared hardware floors (see
 * `minVramGb`) but have not been validated by the maintainer this cycle.
 */

export const UNTESTED_MODEL_KEYS: ReadonlySet<string> = new Set<string>([
  // VLM OCR family (declared floors 8-14GB)
  "got_ocr2",
  "qwen2_5_vl_3b",
  "glm_ocr_onnx",
  "paddleocr_vl_1_5",
  "paddleocr_vl_manga",
  "mangalmm",
  "rolmocr",
  // Local GGUF translation with a declared 6GB floor
  "sakura_galtransl_7b_v3_7",
]);

/** Models the maintainer has validated this cycle (empty for now). */
export const TESTED_MODEL_KEYS: ReadonlySet<string> = new Set<string>([]);

export function isUntestedModel(key: string): boolean {
  return UNTESTED_MODEL_KEYS.has(key);
}
