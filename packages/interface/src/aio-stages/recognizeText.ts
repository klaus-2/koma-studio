/** Recognize Text stage-run. */
import type { AioTextRegion, OcrApiResponse } from '../types/dashboard.types';
import {
  toCustomLlmRequestPayload,
  type CustomLlmRequestProfile,
  type LlmRequestSettings,
} from '../utils/customLlm';
import { createStageForm } from './formPrep';
import { mergeOcrIntoRegions } from './merge';
import { toOcrRegionsJson } from './payloads';
import { STAGE_TIMEOUT_MS, runStageForm, type StageRunOptions } from './transport';
import type {
  FinishedStageRun,
  RegionList,
  StageImageRef,
  StageRuntime,
} from './types';

export interface RecognizeTextStageArgs {
  image: StageImageRef;
  modelKey: string;
  sourceLanguage: string;
  regions: RegionList;
  useGpu?: boolean;
  useCloudOcr?: boolean;
  llmSettings?: LlmRequestSettings | null;
  customProfile?: CustomLlmRequestProfile | null;
}

export function runRecognizeTextStage(
  args: RecognizeTextStageArgs,
  runtime: StageRuntime,
  options: StageRunOptions,
): Promise<FinishedStageRun<AioTextRegion[]>> {
  // useGpu stays out of the shared prep: it is appended below, only when the
  // caller does not force cloud OCR.
  const form = createStageForm({
    file: args.image.file,
    modelKey: args.modelKey,
    useGpu: undefined,
  });
  form.append('language', args.sourceLanguage);
  form.append('regions', toOcrRegionsJson(args.regions, args.image));
  if (args.llmSettings) {
    form.append('llm_settings', JSON.stringify(args.llmSettings));
    const customPayload = toCustomLlmRequestPayload(args.customProfile);
    if (customPayload) form.append('custom_llm', JSON.stringify(customPayload));
  }
  if (args.useGpu !== undefined && !args.useCloudOcr) {
    form.append('use_gpu', String(args.useGpu));
  }

  return runStageForm(runtime, options, {
    path: '/ocr',
    form,
    timeoutMs: STAGE_TIMEOUT_MS.recognizeText,
    parse: async (response) => {
      const payload = (await response.json()) as OcrApiResponse;
      return mergeOcrIntoRegions(args.regions, payload);
    },
  });
}
