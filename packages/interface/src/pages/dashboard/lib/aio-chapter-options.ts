import { AIO_PRESET_STAGE_KEYS } from '@/constants/dashboard.constants';
import type { AioStageOptionMap } from '@/models/aioStageCatalog';
import type {
  AioLanguageModelPreset,
  AioStageKey,
} from '@/types/aioModelPresets';
import type { LocalAioBatchOptions } from '@/pages/dashboard/lib/local-aio-batch';
import {
  isCloudOcrModelKey,
  isCloudTranslationModelKey,
} from '@/utils/customLlm';
import { normalizePresetLanguage } from '@/utils/dashboard.utils';

/**
 * True when the local batch sidecar can run this model for the stage: the
 * catalog lists it, it is installed and implemented, and it is not a cloud
 * model (the chapter queue only speaks the local batch transport).
 */
export function isChapterPresetStageRunnable(
  stage: AioStageKey,
  modelKey: string,
  stageOptions: AioStageOptionMap,
): boolean {
  const option = stageOptions[stage].find((entry) => entry.key === modelKey);

  if (!option || !option.implemented || !option.available) {
    return false;
  }

  if (stage === 'recognizeText' && isCloudOcrModelKey(modelKey)) {
    return false;
  }

  if (stage === 'getTranslations' && isCloudTranslationModelKey(modelKey)) {
    return false;
  }

  return true;
}

/** All-or-nothing: a preset with one unrunnable stage is not offered/used. */
export function isChapterPresetRunnable(
  preset: AioLanguageModelPreset,
  stageOptions: AioStageOptionMap,
): boolean {
  return AIO_PRESET_STAGE_KEYS.every((stage) =>
    isChapterPresetStageRunnable(stage, preset.stageModels[stage], stageOptions),
  );
}

/**
 * Overlays a runnable chapter preset onto the run options. A preset that is not
 * fully runnable keeps the run's options for every stage, matching what the
 * chapter picker offers.
 */
export function resolveChapterBatchOptions(
  base: LocalAioBatchOptions,
  preset: AioLanguageModelPreset | null,
  stageOptions: AioStageOptionMap,
): LocalAioBatchOptions {
  if (!preset || !isChapterPresetRunnable(preset, stageOptions)) {
    return base;
  }

  return {
    ...base,
    detectModelKey: preset.stageModels.detectText,
    ocrModelKey: preset.stageModels.recognizeText,
    translationModelKey: preset.stageModels.getTranslations,
    segmentModelKey: preset.stageModels.segmentText,
    cleanModelKey: preset.stageModels.cleanImage,
  };
}

/**
 * Finds the preset a chapter is assigned to, ignoring presets saved for a
 * different source language. An unknown id resolves to null (run options).
 */
export function findChapterPreset(
  presets: readonly AioLanguageModelPreset[],
  presetId: string | undefined,
  sourceLanguage: string,
): AioLanguageModelPreset | null {
  const id = presetId?.trim();

  if (!id) {
    return null;
  }

  const language = normalizePresetLanguage(sourceLanguage);

  return (
    presets.find(
      (preset) =>
        preset.id === id &&
        normalizePresetLanguage(preset.sourceLanguage) === language,
    ) ?? null
  );
}
