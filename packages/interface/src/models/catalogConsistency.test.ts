import { describe, expect, test } from "vitest";

import { BASE_AIO_STAGE_OPTIONS } from "./aioStageCatalog.data";
import {
  LOCAL_AIO_MODELS_REGISTRY,
  TRANSLATION_MODELS_REGISTRY,
} from "./translation-models-registry";
import { TESTED_MODEL_KEYS, UNTESTED_MODEL_KEYS } from "./untested-models";

const REGISTRY_KEYS = new Set<string>([
  ...TRANSLATION_MODELS_REGISTRY.map((model) => model.id),
  ...LOCAL_AIO_MODELS_REGISTRY.map((model) => model.id),
]);

const STAGE_OPTION_KEYS = new Set<string>(
  Object.values(BASE_AIO_STAGE_OPTIONS).flatMap((options) =>
    options.map((option) => option.key),
  ),
);

const HEAVY_DECLARED_MODELS = [
  ...TRANSLATION_MODELS_REGISTRY.map((model) => ({
    key: model.id,
    minVramGb: model.minVramGb,
  })),
  ...LOCAL_AIO_MODELS_REGISTRY.map((model) => ({
    key: model.id,
    minVramGb: model.minVramGb,
  })),
  ...Object.values(BASE_AIO_STAGE_OPTIONS)
    .flat()
    .map((option) => ({
      key: option.key,
      minVramGb: option.minVramGb,
    })),
];

/** Backend-declared free-VRAM floors (GB) pinned against UI drift. */
const STAGE_MIN_VRAM_GB: Readonly<Record<string, number>> = {
  got_ocr2: 8,
  qwen2_5_vl_3b: 8,
  glm_ocr_onnx: 8,
  paddleocr_vl_1_5: 8,
  paddleocr_vl_manga: 10,
  mangalmm: 14,
  rolmocr: 14,
};

describe("catalog consistency", () => {
  test("every model with a declared ≥6GB floor is flagged tested or untested", () => {
    const heavy = HEAVY_DECLARED_MODELS.filter(
      (model) => (model.minVramGb ?? 0) >= 6,
    );

    expect(heavy.length).toBeGreaterThan(0);
    for (const model of heavy) {
      expect(
        UNTESTED_MODEL_KEYS.has(model.key) || TESTED_MODEL_KEYS.has(model.key),
        `${model.key} declares ${String(model.minVramGb)}GB but has no maintainer flag`,
      ).toBe(true);
    }
  });

  test("stage-catalog VLM minVramGb numbers stay pinned to the declared floors", () => {
    const optionsByKey = new Map(
      Object.values(BASE_AIO_STAGE_OPTIONS)
        .flat()
        .map((option) => [option.key, option]),
    );

    for (const [key, minVramGb] of Object.entries(STAGE_MIN_VRAM_GB)) {
      const option = optionsByKey.get(key);
      expect(option, `${key} is missing from BASE_AIO_STAGE_OPTIONS`).toBeDefined();
      expect(
        option?.minVramGb,
        `${key} must declare ${minVramGb}GB in the UI catalog`,
      ).toBe(minVramGb);
    }
  });

  test("sakura_galtransl_7b_v3_7 keeps its declared 6GB floor", () => {
    const model = TRANSLATION_MODELS_REGISTRY.find(
      (entry) => entry.id === "sakura_galtransl_7b_v3_7",
    );
    expect(model).toBeDefined();
    expect(model?.minVramGb).toBe(6);
  });

  test("untested keys exist in the registries or the stage catalog (no typos)", () => {
    for (const key of UNTESTED_MODEL_KEYS) {
      expect(
        REGISTRY_KEYS.has(key) || STAGE_OPTION_KEYS.has(key),
        `${key} is not a known catalog key`,
      ).toBe(true);
    }
  });

  test("tested keys never overlap untested keys", () => {
    for (const key of TESTED_MODEL_KEYS) {
      expect(UNTESTED_MODEL_KEYS.has(key)).toBe(false);
    }
  });

  test("nllb-200-3.3b stays aligned with the backend CPU device truth", () => {
    const model = TRANSLATION_MODELS_REGISTRY.find(
      (entry) => entry.id === "nllb-200-3.3b",
    );
    expect(model).toBeDefined();
    expect(model?.requirements.gpu).toBe(false);
    expect(model?.requirements.vramMin).toBe("0");
    expect(model?.minVramGb).toBeUndefined();
  });
});
