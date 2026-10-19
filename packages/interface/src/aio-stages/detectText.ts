/** Detect Text stage-run. */
import type { AioTextRegion, DetectApiResponse } from '../types/dashboard.types';
import { regionsFromDetectPayload, type ImageSize } from '../utils/detectTextRegions';
import { STAGE_TIMEOUT_MS, runStageForm, type StageRunOptions } from './transport';
import type { FinishedStageRun, StageRuntime } from './types';

export interface DetectTextStageArgs {
  image: ImageSize & { file: File };
  modelKey: string;
  sourceLanguage: string;
  useGpu?: boolean;
  minRegionSize: number;
  maxAreaRatio?: number;
}

export function runDetectTextStage(
  args: DetectTextStageArgs,
  runtime: StageRuntime,
  options: StageRunOptions,
): Promise<FinishedStageRun<AioTextRegion[]>> {
  const form = new FormData();
  form.append('file', args.image.file);
  form.append('model_key', args.modelKey);
  form.append('language', args.sourceLanguage);
  form.append('source_language', args.sourceLanguage);
  if (args.useGpu !== undefined) form.append('use_gpu', String(args.useGpu));

  return runStageForm(runtime, options, {
    path: '/detect',
    form,
    timeoutMs: STAGE_TIMEOUT_MS.detectText,
    parse: async (response) => {
      const payload = (await response.json()) as DetectApiResponse;
      return regionsFromDetectPayload(payload, args.image, {
        minRegionSize: args.minRegionSize,
        maxAreaRatio: args.maxAreaRatio,
      });
    },
  });
}
