export type AioStageKey =
  | "detectText"
  | "recognizeText"
  | "getTranslations"
  | "segmentText"
  | "cleanImage";

export type AioStageSelection = Record<AioStageKey, string>;

export interface AioLanguageModelPreset {
  id: string;
  name: string;
  description: string;
  sourceLanguage: string;
  stageModels: AioStageSelection;
  createdAt: number;
  updatedAt: number;
}

export interface AioModelPresetStateV2 {
  version: 2;
  presets: AioLanguageModelPreset[];
  activePresetBySourceLanguage: Record<string, string>;
}

export interface CreateAioPresetInput {
  name: string;
  description?: string;
  sourceLanguage: string;
  stageModels: AioStageSelection;
}

export interface UpdateAioPresetInput {
  name?: string;
  description?: string;
  sourceLanguage?: string;
  stageModels?: Partial<AioStageSelection>;
}

export const AIO_MODEL_PRESET_STORAGE_KEY = "koma-aio-model-presets-v2";
