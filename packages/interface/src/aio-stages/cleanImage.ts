/** Clean Image stage-run — brush mask + inpaint. */
import { toCleanRegionsJson } from './payloads';
import { STAGE_TIMEOUT_MS, runStageForm, type StageRunOptions } from './transport';
import type {
  CleanImageStageOptions,
  FinishedStageRun,
  RegionList,
  StageImageRef,
  StageRuntime,
} from './types';

/** Painted alpha becomes a binary inpaint mask. */
export async function brushDataUrlToMaskBlob(
  dataUrl: string,
  imageWidth: number,
  imageHeight: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = imageWidth;
        canvas.height = imageHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, imageWidth, imageHeight);
        const srcData = ctx.getImageData(0, 0, imageWidth, imageHeight).data;

        const maskData = new Uint8ClampedArray(imageWidth * imageHeight * 4);
        for (let i = 0; i < imageWidth * imageHeight; i++) {
          const alpha = srcData[i * 4 + 3];
          const val = alpha !== undefined && alpha > 8 ? 255 : 0;
          maskData[i * 4] = val;
          maskData[i * 4 + 1] = val;
          maskData[i * 4 + 2] = val;
          maskData[i * 4 + 3] = 255;
        }

        const maskImageData = new ImageData(maskData, imageWidth, imageHeight);
        ctx.putImageData(maskImageData, 0, 0);
        canvas.toBlob((blob) => resolve(blob), 'image/png');
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

export interface CleanImageStageArgs {
  image: StageImageRef;
  modelKey: string;
  regions: RegionList;
  fallbackOcrModelKey: string;
  fallbackSegmentModelKey: string;
  options: CleanImageStageOptions;
  useGpu?: boolean;
}

export async function runCleanImageStage(
  args: CleanImageStageArgs,
  runtime: StageRuntime,
  options: StageRunOptions,
): Promise<FinishedStageRun<Blob>> {
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
  if (args.useGpu !== undefined) form.append('use_gpu', String(args.useGpu));
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

  return runStageForm(runtime, options, {
    path: '/inpaint',
    form,
    timeoutMs: STAGE_TIMEOUT_MS.cleanImage,
    parse: (response) => response.blob(),
  });
}
