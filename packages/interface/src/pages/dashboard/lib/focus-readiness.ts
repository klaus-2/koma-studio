/**
 * Focus Mode preflight readiness.
 *
 * Mirrors, stage for stage and in the same order, the readiness resolution
 * the AIO execution preparation performs at run time
 * (`useAioExecutionPreparation`): detect → OCR → segment → clean →
 * translation, honouring the stage toggles. The result powers a guidance
 * banner only — `processAIO` re-resolves everything on click and remains
 * the single authority, so this derivation can be stale without ever
 * being wrong in effect.
 */

import {
  resolveStageModelReadiness,
  skipStageCatalog,
  stageCatalogOption,
  type LocalModelEntry,
  type ReadinessCustomProfile,
  type StageReadinessRefusal,
  type StageReadinessStage,
  type Translate,
} from '../../../aio-stages/readiness';
import type { AioStageOption } from '../../../models/aioStageCatalog.types';
import type { AioStageKey, AioStageSelection } from '../../../types/aioModelPresets';
import type { FocusStageToggles } from './focus-flow';

export type FocusReadiness =
  | { ready: true }
  | {
      ready: false;
      stage: StageReadinessStage;
      refusal: StageReadinessRefusal;
    };

export interface FocusReadinessInputs {
  steps: FocusStageToggles;
  selection: AioStageSelection;
  /** Same catalog lookup the pipeline execution uses (page-owned). */
  getStageOption: (
    stage: 'recognizeText' | 'getTranslations',
    modelKey: string,
  ) => AioStageOption | null;
  modelEntries: Readonly<Record<string, LocalModelEntry | null | undefined>>;
  customOcrProfile: ReadinessCustomProfile | null;
  customTranslationProfile: ReadinessCustomProfile | null;
  sourceLanguage: string;
  targetLanguage: string;
  /** Localised stage labels (`getAioStageLabels`). */
  stageLabels: Record<AioStageKey, string>;
  t: Translate;
}

export function deriveFocusReadiness(
  inputs: FocusReadinessInputs,
): FocusReadiness {
  const { steps, selection, stageLabels, t } = inputs;

  const check = (
    args: Parameters<typeof resolveStageModelReadiness>[0],
  ): FocusReadiness | null => {
    const readiness = resolveStageModelReadiness(args);
    return readiness.ok
      ? null
      : { ready: false, stage: args.stage, refusal: readiness };
  };

  const detect = check({
    stage: 'detectText',
    stageLabel: stageLabels.detectText,
    modelKey: selection.detectText,
    catalog: skipStageCatalog(),
    modelEntries: inputs.modelEntries,
    t,
  });
  if (detect) return detect;

  if (steps.recognizeText) {
    const ocr = check({
      stage: 'recognizeText',
      stageLabel: stageLabels.recognizeText,
      modelKey: selection.recognizeText,
      catalog: stageCatalogOption(
        inputs.getStageOption('recognizeText', selection.recognizeText),
      ),
      modelEntries: inputs.modelEntries,
      customProfile: inputs.customOcrProfile,
      t,
    });
    if (ocr) return ocr;
  }

  if (steps.segmentText) {
    const segment = check({
      stage: 'segmentText',
      stageLabel: stageLabels.segmentText,
      modelKey: selection.segmentText,
      catalog: skipStageCatalog(),
      modelEntries: inputs.modelEntries,
      t,
    });
    if (segment) return segment;
  }

  if (steps.cleanImage) {
    const clean = check({
      stage: 'cleanImage',
      stageLabel: stageLabels.cleanImage,
      modelKey: selection.cleanImage,
      catalog: skipStageCatalog(),
      modelEntries: inputs.modelEntries,
      t,
    });
    if (clean) return clean;
  }

  if (steps.getTranslations) {
    const translation = check({
      stage: 'getTranslations',
      stageLabel: stageLabels.getTranslations,
      modelKey: selection.getTranslations,
      catalog: stageCatalogOption(
        inputs.getStageOption('getTranslations', selection.getTranslations),
      ),
      modelEntries: inputs.modelEntries,
      customProfile: inputs.customTranslationProfile,
      languages: {
        source: inputs.sourceLanguage,
        target: inputs.targetLanguage,
      },
      t,
    });
    if (translation) return translation;
  }

  return { ready: true };
}
