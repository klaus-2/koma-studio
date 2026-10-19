/** Get Translations stage-run. */
import type { AioTextRegion, TranslationApiResponse } from '../types/dashboard.types';
import type { LlmRequestSettings } from '../utils/customLlm';
import { mergeTranslationIntoRegions } from './merge';
import { toTranslateRegionsJson } from './payloads';
import { STAGE_TIMEOUT_MS, postStageForm } from './transport';
import type {
  RegionList,
  StageCustomLlmProfile,
  StageImageRef,
  StageRunResult,
  StageRuntime,
} from './types';
import { toStageCustomLlmPayload } from './types';

export interface GetTranslationsStageArgs {
  image: StageImageRef;
  modelKey: string;
  sourceLanguage: string;
  targetLanguage: string;
  regions: RegionList;
  fallbackOcrModelKey: string;
  llmSettings?: LlmRequestSettings | null;
  customProfile?: StageCustomLlmProfile | null;
  includeImagePayload?: boolean;
}

export async function runGetTranslationsStage(
  args: GetTranslationsStageArgs,
  runtime: StageRuntime,
  failurePrefix = 'Failed to translate text',
): Promise<StageRunResult<AioTextRegion[]>> {
  const form = new FormData();
  form.append('model_key', args.modelKey);
  form.append('source_language', args.sourceLanguage);
  form.append('target_language', args.targetLanguage);
  if (args.includeImagePayload && args.llmSettings) {
    form.append('file', args.image.file);
    form.append('llm_settings', JSON.stringify(args.llmSettings));
    const customPayload = toStageCustomLlmPayload(args.customProfile);
    if (customPayload) form.append('custom_llm', JSON.stringify(customPayload));
  }
  form.append(
    'regions',
    toTranslateRegionsJson(args.regions, args.image, args.fallbackOcrModelKey),
  );

  const posted = await postStageForm(
    runtime,
    '/translate',
    form,
    STAGE_TIMEOUT_MS.getTranslations,
    failurePrefix,
  );
  if (!posted.ok) return posted;

  const payload = (await posted.value.json()) as TranslationApiResponse;
  return {
    ok: true,
    response: posted.response,
    value: mergeTranslationIntoRegions(args.regions, payload),
  };
}
