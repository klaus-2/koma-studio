/** Detect Text stage-run. */
import type { AioTextRegion, DetectApiResponse } from '../types/dashboard.types';
import { regionsFromDetectPayload, type ImageSize } from '../utils/detectTextRegions';
import { STAGE_TIMEOUT_MS, postStageForm } from './transport';
import type { StageGpuFlags, StageRunResult, StageRuntime } from './types';

export interface DetectTextStageArgs {
  image: ImageSize & { file: File };
  modelKey: string;
  sourceLanguage: string;
  gpu?: StageGpuFlags;
  minRegionSize: number;
  maxAreaRatio?: number;
}

export async function runDetectTextStage(
  args: DetectTextStageArgs,
  runtime: StageRuntime,
  failurePrefix = 'Failed to detect text',
): Promise<StageRunResult<AioTextRegion[]>> {
  const form = new FormData();
  form.append('file', args.image.file);
  form.append('model_key', args.modelKey);
  form.append('language', args.sourceLanguage);
  form.append('source_language', args.sourceLanguage);
  if (args.gpu) form.append('use_gpu', String(Boolean(args.gpu.detectText)));

  const posted = await postStageForm(
    runtime,
    '/detect',
    form,
    STAGE_TIMEOUT_MS.detectText,
    failurePrefix,
  );
  if (!posted.ok) return posted;

  const payload = (await posted.value.json()) as DetectApiResponse;
  const regions = regionsFromDetectPayload(payload, args.image, {
    minRegionSize: args.minRegionSize,
    maxAreaRatio: args.maxAreaRatio,
  });
  return { ok: true, response: posted.response, value: regions };
}
