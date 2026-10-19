/** Clean Image stage-run — brush mask + inpaint. */
import { brushDataUrlToMaskBlob } from './brushMask';
import { toCleanRegionsJson } from './payloads';
import { STAGE_TIMEOUT_MS, postStageForm } from './transport';
import type {
  CleanImageStageOptions,
  RegionList,
  StageGpuFlags,
  StageImageRef,
  StageRunResult,
  StageRuntime,
} from './types';

export interface CleanImageStageArgs {
  image: StageImageRef;
  modelKey: string;
  regions: RegionList;
  fallbackOcrModelKey: string;
  fallbackSegmentModelKey: string;
  options: CleanImageStageOptions;
  gpu?: StageGpuFlags;
}

export async function runCleanImageStage(
  args: CleanImageStageArgs,
  runtime: StageRuntime,
  failurePrefix = 'Failed to clean the image',
): Promise<StageRunResult<Blob>> {
  let brushMaskBlob: Blob | null = null;
  if (args.options.brushDataUrl) {
    brushMaskBlob = await brushDataUrlToMaskBlob(
      args.options.brushDataUrl,
      args.image.width,
      args.image.height,
    );
  }

  const form = new FormData();
  form.append('file', args.image.file);
  if (brushMaskBlob) {
    form.append('brush_mask', brushMaskBlob, 'brush_mask.png');
  }
  form.append('model_key', args.modelKey);
  if (args.gpu) form.append('use_gpu', String(Boolean(args.gpu.cleanImage)));
  form.append('mask_dilation', String(args.options.maskDilation));
  form.append('hd_strategy', args.options.hdStrategy);
  form.append('hd_strategy_resize_limit', String(args.options.hdResizeLimit));
  form.append('hd_strategy_crop_margin', String(args.options.hdCropMargin));
  form.append(
    'hd_strategy_crop_trigger_size',
    String(args.options.hdCropTriggerSize),
  );
  form.append(
    'regions',
    toCleanRegionsJson(
      args.regions,
      args.image,
      args.fallbackOcrModelKey,
      args.fallbackSegmentModelKey,
    ),
  );

  const posted = await postStageForm(
    runtime,
    '/inpaint',
    form,
    STAGE_TIMEOUT_MS.cleanImage,
    failurePrefix,
  );
  if (!posted.ok) return posted;

  const blob = await posted.value.blob();
  return { ok: true, response: posted.response, value: blob };
}

export { brushDataUrlToMaskBlob };
