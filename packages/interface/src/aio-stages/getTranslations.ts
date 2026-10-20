/** Get Translations stage-run. */
import type { AioTextRegion, TranslationApiResponse } from '../types/dashboard.types';
import {
  toCustomLlmRequestPayload,
  type CustomLlmRequestProfile,
  type LlmRequestSettings,
} from '../utils/customLlm';
import { mergeTranslationIntoRegions } from './merge';
import { toTranslateRegionsJson } from './payloads';
import { STAGE_TIMEOUT_MS, runStageForm, type StageRunOptions } from './transport';
import type {
  FinishedStageRun,
  RegionList,
  StageImageRef,
  StageRuntime,
} from './types';

export interface GetTranslationsStageArgs {
  image: StageImageRef;
  modelKey: string;
  sourceLanguage: string;
  targetLanguage: string;
  regions: RegionList;
  fallbackOcrModelKey: string;
  /** Presence sends image + llm_settings + custom_llm (LLM / custom providers). */
  llmSettings?: LlmRequestSettings | null;
  customProfile?: CustomLlmRequestProfile | null;
  /** AI SFX mode: translation_mode + extra_context on the form. */
  sfxExtraContext?: string;
  /** Replace llm_settings wholesale (SFX rewrites extra_context / notes). */
  llmSettingsOverride?: LlmRequestSettings | null;
}

export function runGetTranslationsStage(
  args: GetTranslationsStageArgs,
  runtime: StageRuntime,
  options: StageRunOptions,
): Promise<FinishedStageRun<AioTextRegion[]>> {
  const form = new FormData();
  form.append('model_key', args.modelKey);
  form.append('source_language', args.sourceLanguage);
  form.append('target_language', args.targetLanguage);
  if (args.sfxExtraContext !== undefined) {
    form.append('translation_mode', 'sfx');
    form.append('extra_context', args.sfxExtraContext);
  }
  const effectiveLlmSettings =
    args.llmSettingsOverride !== undefined
      ? args.llmSettingsOverride
      : args.llmSettings;
  if (effectiveLlmSettings) {
    form.append('file', args.image.file);
    form.append('llm_settings', JSON.stringify(effectiveLlmSettings));
    const customPayload = toCustomLlmRequestPayload(args.customProfile);
    if (customPayload) form.append('custom_llm', JSON.stringify(customPayload));
  }
  form.append('regions', toTranslateRegionsJson(args.regions, args.fallbackOcrModelKey));

  return runStageForm(runtime, options, {
    path: '/translate',
    form,
    timeoutMs: STAGE_TIMEOUT_MS.getTranslations,
    parse: async (response) => {
      const payload = (await response.json()) as TranslationApiResponse;
      return mergeTranslationIntoRegions(args.regions, payload);
    },
  });
}
