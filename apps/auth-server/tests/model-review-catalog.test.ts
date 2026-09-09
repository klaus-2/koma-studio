import assert from "node:assert/strict";
import test from "node:test";

import {
  filterModelReviewCatalog,
  getModelReviewCatalogEntry,
} from "../src/services/model-review-catalog.js";

test("model review catalog includes new local OCR models and omits obsolete ollama entry", () => {
  const catalog = filterModelReviewCatalog({});
  const ids = new Set(catalog.map((entry) => entry.modelId));

  for (const modelId of [
    "sugoi_v4_ja_en_ct2",
    "m2m100_1_2b_ct2",
    "comic_text_detector",
    "meiki_ocr",
    "paddleocr_vl_manga",
    "got_ocr2",
    "qwen2_5_vl_3b",
    "mangalmm",
    "rolmocr",
    "glm_ocr_onnx",
  ]) {
    assert.equal(ids.has(modelId), true, `missing ${modelId}`);
  }

  assert.equal(ids.has("qwen2.5-7b-ollama"), false);
});

test("new studio OCR models are classified as local recognizeText entries", () => {
  const got = getModelReviewCatalogEntry("got_ocr2");
  assert.ok(got);
  assert.equal(got.stage, "recognizeText");
  assert.equal(got.sourceType, "local");

  const paddle = getModelReviewCatalogEntry("paddleocr_vl_manga");
  assert.ok(paddle);
  assert.equal(paddle.stage, "recognizeText");
  assert.equal(paddle.sourceType, "local");
});
