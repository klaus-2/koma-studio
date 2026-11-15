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

describe("catalog consistency", () => {
  test("every model with a declared ≥6GB floor is flagged tested or untested", () => {
    const heavy = [
      ...TRANSLATION_MODELS_REGISTRY,
      ...LOCAL_AIO_MODELS_REGISTRY,
    ].filter((model) => (model.minVramGb ?? 0) >= 6);

    expect(heavy.length).toBeGreaterThan(0);
    for (const model of heavy) {
      expect(
        UNTESTED_MODEL_KEYS.has(model.id) || TESTED_MODEL_KEYS.has(model.id),
        `${model.id} declares ${String(model.minVramGb)}GB but has no maintainer flag`,
      ).toBe(true);
    }
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
