import { describe, expect, it } from "vitest";

import {
  TRANSLATION_MODELS_BY_ID,
  TRANSLATION_MODELS_REGISTRY,
} from "../models/translation-models-registry";
import type { TranslationModel } from "../models/types";
import {
  isTranslationAutoSelectionKey,
  resolveTranslationAutoModel,
  resolveTranslationStageExecutionKey,
  toAutoResolvedBadge,
  TRANSLATION_AUTO_MODEL_KEY,
  type TranslationAutoDeviceInfo,
  type TranslationAutoResolutionInput,
} from "./translationAutoResolution";

const deviceInfo = (
  has_gpu: boolean,
  vram_gb: number | null,
): TranslationAutoDeviceInfo => ({ has_gpu, vram_gb });

const entriesFor = (
  statuses: Readonly<Record<string, string>>,
): TranslationAutoResolutionInput["installEntries"] =>
  Object.fromEntries(
    Object.entries(statuses).map(([modelId, status]) => [modelId, { status }]),
  );

const baseInput: TranslationAutoResolutionInput = {
  registryModels: TRANSLATION_MODELS_REGISTRY,
  installEntries: {},
  sourceLanguage: "ja",
  targetLanguage: "en",
  deviceInfo: null,
};

const input = (
  overrides: Partial<TranslationAutoResolutionInput>,
): TranslationAutoResolutionInput => ({ ...baseInput, ...overrides });

const registryModel = (modelId: string): TranslationModel => {
  const model = TRANSLATION_MODELS_BY_ID[modelId];
  if (model === undefined) {
    throw new Error(`missing registry fixture: ${modelId}`);
  }
  return model;
};

describe("resolveTranslationAutoModel — GATE-2 preference table (option a)", () => {
  it("JA→EN with GPU vram ≥ 3.5 resolves sugoi first", () => {
    const result = resolveTranslationAutoModel(
      input({
        installEntries: entriesFor({
          sugoi_v4_ja_en_ct2: "installed",
          "nllb-200-600m-int8": "installed",
        }),
        deviceInfo: deviceInfo(true, 4),
      }),
    );
    expect(result).toEqual({
      modelKey: "sugoi_v4_ja_en_ct2",
      resolvedName: registryModel("sugoi_v4_ja_en_ct2").name,
      resolvedFrom: "auto",
    });
  });

  it("JA→EN at the exact 3.5 GB floor still takes the GPU branch", () => {
    const result = resolveTranslationAutoModel(
      input({
        installEntries: entriesFor({
          sugoi_v4_ja_en_ct2: "installed",
          "nllb-200-600m-int8": "installed",
        }),
        deviceInfo: deviceInfo(true, 3.5),
      }),
    );
    expect(result.modelKey).toBe("sugoi_v4_ja_en_ct2");
  });

  it("JA→EN with GPU below the floor falls back to the CPU int8 order", () => {
    const result = resolveTranslationAutoModel(
      input({
        installEntries: entriesFor({
          sugoi_v4_ja_en_ct2: "installed",
          "nllb-200-600m-int8": "installed",
        }),
        deviceInfo: deviceInfo(true, 3.4),
      }),
    );
    expect(result.modelKey).toBe("nllb-200-600m-int8");
  });

  it("JA→EN CPU-only prefers nllb-200-600m-int8", () => {
    const result = resolveTranslationAutoModel(
      input({
        installEntries: entriesFor({
          sugoi_v4_ja_en_ct2: "installed",
          "nllb-200-600m-int8": "installed",
          "nllb-200-1.3b-int8-ct2": "installed",
        }),
        deviceInfo: deviceInfo(false, 8),
      }),
    );
    expect(result.modelKey).toBe("nllb-200-600m-int8");
  });

  it("JA→EN CPU falls through to nllb-200-1.3b-int8-ct2 when 600m is missing", () => {
    const result = resolveTranslationAutoModel(
      input({
        installEntries: entriesFor({
          "nllb-200-1.3b-int8-ct2": "installed",
        }),
        deviceInfo: null,
      }),
    );
    expect(result.modelKey).toBe("nllb-200-1.3b-int8-ct2");
  });

  it("other pairs resolve 600m → 1.3b → m2m100 in order, skipping uninstalled", () => {
    const allInstalled = entriesFor({
      "nllb-200-600m-int8": "installed",
      "nllb-200-1.3b-int8-ct2": "installed",
      m2m100_1_2b_ct2: "installed",
    });
    expect(
      resolveTranslationAutoModel(
        input({ installEntries: allInstalled, sourceLanguage: "zh", targetLanguage: "en" }),
      ).modelKey,
    ).toBe("nllb-200-600m-int8");
    expect(
      resolveTranslationAutoModel(
        input({
          installEntries: entriesFor({
            "nllb-200-1.3b-int8-ct2": "installed",
            m2m100_1_2b_ct2: "installed",
          }),
          sourceLanguage: "zh",
          targetLanguage: "en",
        }),
      ).modelKey,
    ).toBe("nllb-200-1.3b-int8-ct2");
    expect(
      resolveTranslationAutoModel(
        input({
          installEntries: entriesFor({ m2m100_1_2b_ct2: "installed" }),
          sourceLanguage: "zh",
          targetLanguage: "en",
        }),
      ).modelKey,
    ).toBe("m2m100_1_2b_ct2");
  });

  it("never picks sugoi for a non JA→EN pair even when installed", () => {
    const result = resolveTranslationAutoModel(
      input({
        installEntries: entriesFor({
          sugoi_v4_ja_en_ct2: "installed",
          m2m100_1_2b_ct2: "installed",
        }),
        sourceLanguage: "ja",
        targetLanguage: "pt",
        deviceInfo: deviceInfo(true, 8),
      }),
    );
    expect(result.modelKey).toBe("m2m100_1_2b_ct2");
  });

  it("returns null when nothing is installed", () => {
    const result = resolveTranslationAutoModel(
      input({
        installEntries: {},
        deviceInfo: deviceInfo(true, 8),
      }),
    );
    expect(result).toEqual({ modelKey: null, resolvedName: "", resolvedFrom: "auto" });
    expect(toAutoResolvedBadge(result)).toBeNull();
  });

  it("treats update_available as installed", () => {
    const result = resolveTranslationAutoModel(
      input({
        installEntries: entriesFor({ "nllb-200-600m-int8": "update_available" }),
      }),
    );
    expect(result.modelKey).toBe("nllb-200-600m-int8");
  });

  it("skips candidates whose install state is not installed (never triggers a download)", () => {
    const result = resolveTranslationAutoModel(
      input({
        installEntries: entriesFor({
          "nllb-200-600m-int8": "downloading",
          "nllb-200-1.3b-int8-ct2": "not_installed",
          m2m100_1_2b_ct2: "installed",
        }),
        sourceLanguage: "zh",
        targetLanguage: "en",
      }),
    );
    expect(result.modelKey).toBe("m2m100_1_2b_ct2");
  });

  it("skips candidates with a missing install entry", () => {
    const result = resolveTranslationAutoModel(
      input({
        installEntries: entriesFor({ "nllb-200-1.3b-int8-ct2": "installed" }),
        sourceLanguage: "zh",
        targetLanguage: "en",
      }),
    );
    expect(result.modelKey).toBe("nllb-200-1.3b-int8-ct2");
  });

  it("skips language-incompatible registry models (same filter the control applies)", () => {
    const narrowedSugoi: TranslationModel = {
      ...registryModel("sugoi_v4_ja_en_ct2"),
      sourceLanguages: ["de"],
      targetLanguages: ["fr"],
    };
    const result = resolveTranslationAutoModel(
      input({
        registryModels: [...TRANSLATION_MODELS_REGISTRY, narrowedSugoi],
        installEntries: entriesFor({
          sugoi_v4_ja_en_ct2: "installed",
          "nllb-200-600m-int8": "installed",
        }),
        deviceInfo: deviceInfo(true, 8),
      }),
    );
    expect(result.modelKey).toBe("nllb-200-600m-int8");
  });

  it("never returns a legacy/cloud option even when present in the install entries", () => {
    const result = resolveTranslationAutoModel(
      input({
        installEntries: entriesFor({
          google_translate: "installed",
          "nllb-200-600m-int8": "installed",
        }),
        deviceInfo: deviceInfo(true, 8),
      }),
    );
    expect(result.modelKey).toBe("nllb-200-600m-int8");
    expect(TRANSLATION_MODELS_REGISTRY.some((model) => model.id === "google_translate")).toBe(
      false,
    );
  });

  it("deviceInfo null keeps the conservative CPU order", () => {
    const result = resolveTranslationAutoModel(
      input({
        installEntries: entriesFor({
          sugoi_v4_ja_en_ct2: "installed",
          "nllb-200-600m-int8": "installed",
        }),
        deviceInfo: null,
      }),
    );
    expect(result.modelKey).toBe("nllb-200-600m-int8");
  });

  it("ignores GPU vram when has_gpu is false", () => {
    const result = resolveTranslationAutoModel(
      input({
        installEntries: entriesFor({
          sugoi_v4_ja_en_ct2: "installed",
          "nllb-200-600m-int8": "installed",
        }),
        deviceInfo: deviceInfo(false, 24),
      }),
    );
    expect(result.modelKey).toBe("nllb-200-600m-int8");
  });

  it("normalizes the language pair casing and whitespace", () => {
    const result = resolveTranslationAutoModel(
      input({
        installEntries: entriesFor({ sugoi_v4_ja_en_ct2: "installed" }),
        sourceLanguage: " JA ",
        targetLanguage: "EN",
        deviceInfo: deviceInfo(true, 4),
      }),
    );
    expect(result.modelKey).toBe("sugoi_v4_ja_en_ct2");
  });
});

describe("resolveTranslationStageExecutionKey", () => {
  const readyInput = input({
    installEntries: entriesFor({ "nllb-200-600m-int8": "installed" }),
    deviceInfo: deviceInfo(false, null),
  });

  it("resolves the Auto sentinel to the concrete registry id", () => {
    expect(resolveTranslationStageExecutionKey(TRANSLATION_AUTO_MODEL_KEY, readyInput)).toBe(
      "nllb-200-600m-int8",
    );
  });

  it("keeps the sentinel when nothing is installed so readiness refuses instead of swapping engines", () => {
    expect(
      resolveTranslationStageExecutionKey(TRANSLATION_AUTO_MODEL_KEY, input({})),
    ).toBe(TRANSLATION_AUTO_MODEL_KEY);
  });

  it("returns an explicit pin verbatim (the resolver is bypassed)", () => {
    expect(
      resolveTranslationStageExecutionKey("sugoi_v4_ja_en_ct2", readyInput),
    ).toBe("sugoi_v4_ja_en_ct2");
    expect(
      resolveTranslationStageExecutionKey("google_translate", readyInput),
    ).toBe("google_translate");
  });
});

describe("sentinel", () => {
  it("is distinct from the sidecar OCR AUTO_KEY and bare 'auto' semantics", () => {
    expect(TRANSLATION_AUTO_MODEL_KEY).toBe("__auto__");
    expect(isTranslationAutoSelectionKey("auto")).toBe(false);
    expect(isTranslationAutoSelectionKey("__auto__")).toBe(true);
    expect(isTranslationAutoSelectionKey("")).toBe(false);
  });

  it("collides with no registry id", () => {
    expect(
      TRANSLATION_MODELS_REGISTRY.some((model) => model.id === TRANSLATION_AUTO_MODEL_KEY),
    ).toBe(false);
  });
});
