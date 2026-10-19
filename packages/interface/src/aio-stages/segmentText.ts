/** Segment Text stage-run. */
import type { AioTextRegion, SegmentApiResponse } from '../types/dashboard.types';
import { mergeSegmentIntoRegions } from './merge';
import { toSegmentRegionsJson } from './payloads';
import { STAGE_TIMEOUT_MS, postStageForm } from './transport';
import type { RegionList, StageGpuFlags, StageImageRef, StageRunResult, StageRuntime } from './types';

export interface SegmentTextStageArgs {
  image: StageImageRef;
  modelKey: string;
  regions: RegionList;
  fallbackOcrModelKey: string;
  fallbackTranslatorModelKey: string;
  gpu?: StageGpuFlags;
}

export async function runSegmentTextStage(
  args: SegmentTextStageArgs,
  runtime: StageRuntime,
  failurePrefix = 'Failed to segment text',
): Promise<StageRunResult<AioTextRegion[]>> {
  const form = new FormData();
  form.append('file', args.image.file);
  form.append('model_key', args.modelKey);
  if (args.gpu) form.append('use_gpu', String(Boolean(args.gpu.segmentText)));
  form.append(
    'regions',
    toSegmentRegionsJson(
      args.regions,
      args.image,
      args.fallbackOcrModelKey,
      args.fallbackTranslatorModelKey,
    ),
  );

  const posted = await postStageForm(
    runtime,
    '/segment',
    form,
    STAGE_TIMEOUT_MS.segmentText,
    failurePrefix,
  );
  if (!posted.ok) return posted;

  const payload = (await posted.value.json()) as SegmentApiResponse;
  return {
    ok: true,
    response: posted.response,
    value: mergeSegmentIntoRegions(args.regions, payload),
  };
}
