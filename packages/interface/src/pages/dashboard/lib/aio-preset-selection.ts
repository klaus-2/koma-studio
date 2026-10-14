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
