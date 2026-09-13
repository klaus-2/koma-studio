/// <reference lib="webworker" />

import {
  applyImageFiltersToContext,
  calculateAxisOffset,
  getRotatedDimensions,
  resolveStitchOutputMetrics,
} from './stitchUtils';
import type { StitchRenderJob, StitchRenderResult } from './types';

declare const self: DedicatedWorkerGlobalScope;

type StitchWorkerIncomingMessage =
  | { type: 'render'; job: StitchRenderJob };

type StitchWorkerOutgoingMessage =
  | { type: 'progress'; requestId: string; progress: number }
  | { type: 'result'; result: StitchRenderResult }
  | { type: 'error'; requestId: string; message: string };

const postMessageSafe = (message: StitchWorkerOutgoingMessage): void => {
  self.postMessage(message);
};

const decodeImageBitmap = async (file: File): Promise<ImageBitmap> => {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return createImageBitmap(file);
  }
};

const renderJob = async (job: StitchRenderJob): Promise<StitchRenderResult> => {
  const outputMetrics = resolveStitchOutputMetrics(job.images, job.layoutMode, job.gap);
  const outputCanvas = new OffscreenCanvas(outputMetrics.width, outputMetrics.height);
  const outputContext = outputCanvas.getContext('2d', { willReadFrequently: true });
  if (!outputContext) {
    throw new Error('Failed to create the Stitcher rendering context.');
  }

  outputContext.fillStyle = job.background;
  outputContext.fillRect(0, 0, outputMetrics.width, outputMetrics.height);

  let cursorX = 0;
  let cursorY = 0;
  // ponytail: sequential by design — memory-bounded per-page pipeline (parallelizing would hold N decoded pages)
  for (let index = 0; index < job.images.length; index += 1) {
    const imageInput = job.images[index];
    if (!imageInput) continue;
    const bitmap = await decodeImageBitmap(imageInput.file);
    const dims = getRotatedDimensions(imageInput);
    const tempCanvas = new OffscreenCanvas(dims.width, dims.height);
    const tempContext = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!tempContext) {
      bitmap.close();
      throw new Error('Failed to prepare the intermediate Stitcher image.');
    }

    tempContext.save();
    tempContext.translate(dims.width / 2, dims.height / 2);
    tempContext.rotate((imageInput.rotation * Math.PI) / 180);
    if (imageInput.rotation % 180 !== 0) {
      tempContext.drawImage(bitmap, -dims.height / 2, -dims.width / 2, dims.height, dims.width);
    } else {
      tempContext.drawImage(bitmap, -dims.width / 2, -dims.height / 2, dims.width, dims.height);
    }
    tempContext.restore();
    bitmap.close();

    applyImageFiltersToContext(tempContext, dims.width, dims.height, imageInput.filters);

    if (job.layoutMode === 'webtoon') {
      const drawX = calculateAxisOffset(outputMetrics.width, dims.width, job.alignMode);
      outputContext.drawImage(tempCanvas, drawX, cursorY);
      cursorY += dims.height + job.gap;
    } else {
      const drawY = calculateAxisOffset(outputMetrics.height, dims.height, job.alignMode);
      outputContext.drawImage(tempCanvas, cursorX, drawY);
      cursorX += dims.width + job.gap;
    }

    postMessageSafe({
      type: 'progress',
      requestId: job.requestId,
      progress: ((index + 1) / job.images.length) * 100,
    });
  }

  const blob = await outputCanvas.convertToBlob({
    type: job.mimeType,
    quality: job.mimeType === 'image/png' ? undefined : job.quality,
  });

  return {
    requestId: job.requestId,
    blob,
    width: outputMetrics.width,
    height: outputMetrics.height,
  };
};

self.onmessage = async (event: MessageEvent<StitchWorkerIncomingMessage>) => {
  if (event.data.type !== 'render') return;
  const { job } = event.data;
  try {
    const result = await renderJob(job);
    postMessageSafe({ type: 'result', result });
  } catch (error) {
    postMessageSafe({
      type: 'error',
      requestId: job.requestId,
      message: error instanceof Error ? error.message : 'Failed to render the stitch.',
    });
  }
};
