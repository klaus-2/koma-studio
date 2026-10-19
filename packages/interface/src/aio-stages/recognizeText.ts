/** Recognize Text stage-run. */
import type { AioTextRegion, OcrApiResponse } from '../types/dashboard.types';
import type { LlmRequestSettings } from '../utils/customLlm';
import { mergeOcrIntoRegions } from './merge';
import { toOcrRegionsJson } from './payloads';
import { STAGE_TIMEOUT_MS, postStageForm } from './transport';
import type { RegionList, StageCustomLlmProfile, StageGpuFlags, StageImageRef, StageRunResult, StageRuntime } from './types';
import { toStageCustomLlmPayload } from './types';

export interface RecognizeTextStageArgs {
  image: StageImageRef;
  modelKey: string;
  sourceLanguage: string;
  regions: RegionList;
  gpu?: StageGpuFlags;
  useCloudOcr?: boolean;
  llmSettings?: LlmRequestSettings | null;
  customProfile?: StageCustomLlmProfile | null;
}

export async function runRecognizeTextStage(
  args: RecognizeTextStageArgs,
  runtime: StageRuntime,
  failurePrefix = 'Failed to recognize text',
): Promise<StageRunResult<AioTextRegion[]>> {
  const form = new FormData();
  form.append('file', args.image.file);
  form.append('model_key', args.modelKey);
  form.append('language', args.sourceLanguage);
  form.append('regions', toOcrRegionsJson(args.regions, args.image));
  if (args.llmSettings) {
    form.append('llm_settings', JSON.stringify(args.llmSettings));
    const customPayload = toStageCustomLlmPayload(args.customProfile);
    if (customPayload) form.append('custom_llm', JSON.stringify(customPayload));
  }
  if (args.gpu && !args.useCloudOcr) {
    form.append('use_gpu', String(Boolean(args.gpu.recognizeText)));
  }

  const posted = await postStageForm(
    runtime,
    '/ocr',
    form,
    STAGE_TIMEOUT_MS.recognizeText,
    failurePrefix,
  );
  if (!posted.ok) return posted;

  const payload = (await posted.value.json()) as OcrApiResponse;
  return {
    ok: true,
    response: posted.response,
    value: mergeOcrIntoRegions(args.regions, payload),
  };
}
