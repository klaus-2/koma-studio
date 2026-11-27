import {
  AIO_MODEL_PRESET_STORAGE_KEY,
  type AioLanguageModelPreset,
  type AioModelPresetStateV2,
  type AioStageSelection,
} from "../types/aioModelPresets";

export const AIO_DEFAULT_PRESET_ID_PREFIX = "aio-preset-default-";
export const AIO_DEFAULT_PRESETS_SEEDED_STORAGE_KEY = `${AIO_MODEL_PRESET_STORAGE_KEY}:defaults-seeded-v1`;

const stages = (recognizeText: string, getTranslations = "google_translate"): AioStageSelection => ({
  detectText: "font_rtdetr_v2",
  recognizeText,
  getTranslations,
  segmentText: "ctd_text_seg",
  cleanImage: "lama_manga",
});

const DEFAULT_PRESET_SPECS: ReadonlyArray<readonly [sourceLanguage: string, name: string, stageModels: AioStageSelection]> = [
  ["de", "German Default", stages("paddleocr_latin_v5")],
  ["en", "English Default", stages("paddleocr_en_v5")],
  ["es", "Spanish Default", stages("paddleocr_latin_v5")],
  ["fr", "French Default", stages("paddleocr_latin_v5")],
  ["it", "Italian Default", stages("paddleocr_latin_v5")],
  ["ja", "Japanese Default", stages("meiki_ocr")],
  ["ko", "Korean Default", stages("pororo", "nllb-200-1.3b-int8-ct2")],
  ["nl", "Dutch Default", stages("paddleocr_latin_v5")],
  ["ru", "Russian Default", stages("paddleocr")],
];

export const aioDefaultPresetId = (sourceLanguage: string): string =>
  `${AIO_DEFAULT_PRESET_ID_PREFIX}${sourceLanguage}`;

export const DEFAULT_AIO_MODEL_PRESETS: readonly AioLanguageModelPreset[] = DEFAULT_PRESET_SPECS.map(
  ([sourceLanguage, name, stageModels]) => ({
    id: aioDefaultPresetId(sourceLanguage),
    name,
    description: "",
    sourceLanguage,
    stageModels,
    createdAt: 0,
    updatedAt: 0,
  }),
);

const clonePreset = (preset: AioLanguageModelPreset): AioLanguageModelPreset => ({
  ...preset,
  stageModels: { ...preset.stageModels },
});

export const buildDefaultAioPresetState = (): AioModelPresetStateV2 => ({
  version: 2,
  presets: DEFAULT_AIO_MODEL_PRESETS.map(clonePreset),
  activePresetBySourceLanguage: Object.fromEntries(
    DEFAULT_AIO_MODEL_PRESETS.map((preset) => [preset.sourceLanguage, preset.id]),
  ),
});

export const seedDefaultAioPresets = (state: AioModelPresetStateV2): AioModelPresetStateV2 => {
  const coveredLanguages = new Set(state.presets.map((preset) => preset.sourceLanguage));
  const takenIds = new Set(state.presets.map((preset) => preset.id));
  const added = DEFAULT_AIO_MODEL_PRESETS
    .filter((preset) => !coveredLanguages.has(preset.sourceLanguage) && !takenIds.has(preset.id))
    .map(clonePreset);
  if (added.length === 0) return state;
  const activePresetBySourceLanguage = { ...state.activePresetBySourceLanguage };
  for (const preset of added) activePresetBySourceLanguage[preset.sourceLanguage] ??= preset.id;
  return { ...state, presets: [...state.presets, ...added], activePresetBySourceLanguage };
};
