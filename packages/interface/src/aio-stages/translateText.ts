/** Free-text translation stage-run behind the shared transport seam. */
import type {
  TranslationApiResponse,
  TranslatorTextRequestRegion,
} from '../types/dashboard.types';
import {
  toCustomLlmRequestPayload,
  type CustomLlmRequestProfile,
  type LlmRequestSettings,
} from '../utils/customLlm';
import { STAGE_TIMEOUT_MS, runStageForm, type StageRunOptions } from './transport';
import type { FinishedStageRun, StageRuntime } from './types';

export interface TranslateTextStageArgs {
  modelKey: string;
  sourceLanguage: string;
  targetLanguage: string;
  requestRegions: readonly TranslatorTextRequestRegion[];
  llmSettings?: LlmRequestSettings | null;
  customProfile?: CustomLlmRequestProfile | null;
}

/** POST /translate for free-text / structured text documents (no image). */
export function runTranslateTextStage(
  args: TranslateTextStageArgs,
  runtime: StageRuntime,
  options: StageRunOptions,
): Promise<FinishedStageRun<TranslationApiResponse>> {
  const form = new FormData();
  form.append('model_key', args.modelKey);
  form.append('source_language', args.sourceLanguage);
  form.append('target_language', args.targetLanguage);
  form.append('regions', JSON.stringify(args.requestRegions));
  if (args.llmSettings) {
    form.append('llm_settings', JSON.stringify(args.llmSettings));
    const customPayload = toCustomLlmRequestPayload(args.customProfile);
    if (customPayload) {
      form.append('custom_llm', JSON.stringify(customPayload));
    }
  }

  return runStageForm(runtime, options, {
    path: '/translate',
    form,
    timeoutMs: STAGE_TIMEOUT_MS.getTranslations,
    parse: async (response) =>
      (await response.json()) as TranslationApiResponse,
  });
}
