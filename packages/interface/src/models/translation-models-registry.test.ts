import { describe, expect, test } from "vitest";

import {
  AIO_LOCAL_MODELS_BY_STAGE,
  ENHANCE_IMAGE_MODELS_REGISTRY,
  getLocalAioModelById,
  getTranslationModelById,
  listRegistryLanguages,
  LOCAL_AIO_MODELS_REGISTRY,
  TRANSLATION_MODELS_REGISTRY,
} from "./translation-models-registry";

describe("translation models registry", () => {
  test("keeps public registries available after data split", () => {
    expect(TRANSLATION_MODELS_REGISTRY.length).toBeGreaterThan(5);
    expect(LOCAL_AIO_MODELS_REGISTRY.length).toBeGreaterThan(TRANSLATION_MODELS_REGISTRY.length);
    expect(ENHANCE_IMAGE_MODELS_REGISTRY.length).toBe(AIO_LOCAL_MODELS_BY_STAGE.enhanceImage.length);
  });

  test("keeps id lookups stable", () => {
    const firstModel = TRANSLATION_MODELS_REGISTRY[0];
    expect(firstModel).toBeDefined();
    expect(getTranslationModelById(firstModel!.id)).toEqual(firstModel);

    const aioModel = LOCAL_AIO_MODELS_REGISTRY.find((model) => model.stage === "cleanImage");
    expect(aioModel).toBeDefined();
    expect(getLocalAioModelById(aioModel!.id)).toEqual(aioModel);
  });

  test("lists concrete registry languages without wildcards", () => {
    const languages = listRegistryLanguages();
    expect(languages).toEqual([...languages].sort((a, b) => a.localeCompare(b)));
    expect(languages).not.toContain("*");
    expect(languages).not.toContain("multi");
  });
});
