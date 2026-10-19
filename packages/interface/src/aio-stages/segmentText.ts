/** Segment Text stage-run. */
import type { AioTextRegion, SegmentApiResponse } from '../types/dashboard.types';
import { mergeSegmentIntoRegions } from './merge';
import { toSegmentRegionsJson } from './payloads';
import { STAGE_TIMEOUT_MS, runStageForm, type StageRunOptions } from './transport';
import type {
  FinishedStageRun,
  RegionList,
  StageImageRef,
  StageRuntime,
} from './types';

export interface SegmentTextStageArgs {
  image: StageImageRef;
  modelKey: string;
  regions: RegionList;
  fallbackOcrModelKey: string;
  fallbackTranslatorModelKey: string;
  useGpu?: boolean;
}

export function runSegmentTextStage(
  args: SegmentTextStageArgs,
  runtime: StageRuntime,
  options: StageRunOptions,
): Promise<FinishedStageRun<AioTextRegion[]>> {
  const form = new FormData();
  form.append('file', args.image.file);
  form.append('model_key', args.modelKey);
  if (args.useGpu !== undefined) form.append('use_gpu', String(args.useGpu));
  form.append(
    'regions',
    toSegmentRegionsJson(
      args.regions,
      args.image,
      args.fallbackOcrModelKey,
      args.fallbackTranslatorModelKey,
    ),
  );

  return runStageForm(runtime, options, {
    path: '/segment',
    form,
    timeoutMs: STAGE_TIMEOUT_MS.segmentText,
    parse: async (response) => {
      const payload = (await response.json()) as SegmentApiResponse;
      return mergeSegmentIntoRegions(args.regions, payload);
    },
  });
}
