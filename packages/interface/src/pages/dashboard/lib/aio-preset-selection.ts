import { AIO_PRESET_STAGE_KEYS } from '@/constants/dashboard.constants';
import type { AioStageOption } from '@/models/aioStageCatalog';
import type {
  AioLanguageModelPreset,
  AioStageKey,
  AioStageSelection,
} from '@/types/aioModelPresets';

export type PresetStageOptions = Readonly<
  Record<AioStageKey, ReadonlyArray<AioStageOption>>
>;

export type PresetStageAvailability = Record<AioStageKey, Set<string>>;

export const DEFAULT_TRANSLATION_STAGE_MODEL_KEY = 'google_translate';

export interface PresetDownloadOnlyRepair {
  readonly preset: AioLanguageModelPreset;
  readonly replacedKey: string | null;
  readonly replacementName: string;
}

/**
 * A persisted preset may name a translation entry that is still in the catalog
 * but has no runtime (download-only). Repair it to the default translation
 * model so execution never inherits an unrunnable key. A key that is absent
 * from the catalog keeps the existing "unapplied stage" handling, and an
 * installable-but-not-installed key is left untouched.
 */
export function repairDownloadOnlyPresetTranslation(
  preset: AioLanguageModelPreset,
  translationOptions: readonly AioStageOption[],
): PresetDownloadOnlyRepair {
  const requestedKey = preset.stageModels.getTranslations.trim();
  const requestedOption = translationOptions.find(
    (option) => option.key === requestedKey,
  );

  if (!requestedKey || !requestedOption || requestedOption.implemented) {
    return {
      preset,
      replacedKey: null,
      replacementName: requestedOption?.name ?? requestedKey,
    };
  }

  const replacementOption = translationOptions.find(
    (option) => option.key === DEFAULT_TRANSLATION_STAGE_MODEL_KEY,
  );
  const replacementKey =
    replacementOption?.key ?? DEFAULT_TRANSLATION_STAGE_MODEL_KEY;

  return {
    preset: {
      ...preset,
      stageModels: { ...preset.stageModels, getTranslations: replacementKey },
    },
    replacedKey: requestedKey,
    replacementName: replacementOption?.name ?? replacementKey,
  };
}

export function buildPresetStageAvailability(
  options: PresetStageOptions,
): PresetStageAvailability {
  return {
    detectText: new Set(options.detectText.map((option) => option.key)),
    recognizeText: new Set(options.recognizeText.map((option) => option.key)),
    getTranslations: new Set(
      options.getTranslations.map((option) => option.key),
    ),
    segmentText: new Set(options.segmentText.map((option) => option.key)),
    cleanImage: new Set(options.cleanImage.map((option) => option.key)),
  };
}

export function arePresetSelectionsEqual(
  left: AioStageSelection,
  right: AioStageSelection,
): boolean {
  return AIO_PRESET_STAGE_KEYS.every((stage) => left[stage] === right[stage]);
}

export function findUnavailablePresetStage(
  selection: AioStageSelection,
  availability: PresetStageAvailability,
): AioStageKey | undefined {
  return AIO_PRESET_STAGE_KEYS.find(
    (stage) => !availability[stage].has(selection[stage]),
  );
}

export function getPresetApplicationSignature(
  language: string,
  preset: AioLanguageModelPreset | null,
  availability: PresetStageAvailability,
): string {
  return JSON.stringify([
    language,
    preset?.id ?? null,
    AIO_PRESET_STAGE_KEYS.map((stage) => {
      const model = preset?.stageModels[stage] ?? null;

      return [
        stage,
        model,
        model === null ? false : availability[stage].has(model),
      ];
    }),
  ]);
}
