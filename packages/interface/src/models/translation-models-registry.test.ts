import { describe, expect, test } from "vitest";

import { buildModelInstallStates } from "./model-storage";
import { checkModelVersions } from "./model-version-checker";
import type { InstalledModelRecord } from "./types";
import {
  AIO_LOCAL_MODELS_BY_STAGE,
  ENHANCE_IMAGE_MODELS_REGISTRY,
  getLocalAioModelById,
  getModelRuntimeSupport,
  getTranslationModelById,
  isDownloadOnlyModel,
  listRegistryLanguages,
  LOCAL_AIO_MODELS_REGISTRY,
  TRANSLATION_MODELS_REGISTRY,
} from "./translation-models-registry";

const TRANSFORMERS_MODEL_IDS = ["opus-mt-ja-en", "opus-mt-zh-en", "nllb-200-3.3b"] as const;
const DOWNLOAD_ONLY_MODEL_IDS = [
  "nllb-200-600m-int8",
  "nllb-200-1.3b",
  "nllb-200-1.3b-int8-ct2",
] as const;
const PREVIOUS_REGISTRY_VERSION = "1.1.0";

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

  test("routes the three transformers entries through the backend installer", () => {
    for (const modelId of TRANSFORMERS_MODEL_IDS) {
      const model = getTranslationModelById(modelId);
      expect(model).not.toBeNull();
      expect(model?.installStrategy).toBe("backend_managed");
      expect(model?.runtimeFamily).toBe("transformers");
      expect(model?.backendInstallEndpoint).toBe("/models/install");
      expect(model?.version).toBe("1.2.0");
    }
  });

  test("bumps the version only for the three transformers entries", () => {
    const bumped = TRANSLATION_MODELS_REGISTRY.filter((model) => model.version === "1.2.0")
      .map((model) => model.id)
      .sort();
    expect(bumped).toEqual([...TRANSFORMERS_MODEL_IDS].sort());
  });

  test("marks only the three transformers entries as update_available", () => {
    const installedModels: InstalledModelRecord[] = TRANSLATION_MODELS_REGISTRY.map((model) => ({
      modelId: model.id,
      version: PREVIOUS_REGISTRY_VERSION,
      installedAt: "2026-01-01T00:00:00.000Z",
      checksumSHA256: model.checksumSHA256,
      status: "installed",
      modelDir: `/models/${model.id}`,
      manifestPath: `/models/${model.id}/manifest.json`,
      sizeBytes: 1,
    }));

    const updateIds = checkModelVersions(installedModels, TRANSLATION_MODELS_REGISTRY)
      .filter((result) => result.updateAvailable)
      .map((result) => result.modelId)
      .sort();

    expect(updateIds).toEqual([...TRANSFORMERS_MODEL_IDS].sort());
  });

  test("declares download_only exactly on the three direct NLLB variants", () => {
    const flagged = TRANSLATION_MODELS_REGISTRY.filter(
      (model) => getModelRuntimeSupport(model) === "download_only",
    )
      .map((model) => model.id)
      .sort();

    expect(flagged).toEqual([...DOWNLOAD_ONLY_MODEL_IDS].sort());

    for (const modelId of TRANSFORMERS_MODEL_IDS) {
      const model = getTranslationModelById(modelId);
      expect(model).not.toBeNull();
      expect(model && isDownloadOnlyModel(model)).toBe(false);
      expect(model?.runtimeSupport).toBeUndefined();
    }
  });

  test("carries runtimeSupport into the install states", () => {
    const states = buildModelInstallStates(TRANSLATION_MODELS_REGISTRY, []);

    for (const modelId of DOWNLOAD_ONLY_MODEL_IDS) {
      expect(states[modelId]?.model.runtimeSupport).toBe("download_only");
    }
    expect(states["hunyuan_7b_mt_v1_0"]?.model.runtimeSupport).toBeUndefined();
    expect(states["opus-mt-ja-en"]?.model.runtimeSupport).toBeUndefined();
  });
});
