/** Detect Text stage-run. */
import type { AioTextRegion, DetectApiResponse } from '../types/dashboard.types';
import { regionsFromDetectPayload, type ImageSize } from '../utils/detectTextRegions';
import { createStageForm } from './formPrep';
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
  const form = createStageForm({
    file: args.image.file,
    modelKey: args.modelKey,
    useGpu: args.useGpu,
  });
  form.append('language', args.sourceLanguage);
  form.append('source_language', args.sourceLanguage);

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
