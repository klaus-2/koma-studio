import { loadImageFromSource } from '../../../utils/dashboard.utils';
import {
  applyImageFiltersToContext,
  calculateAxisOffset,
  getRotatedDimensions,
  resolveStitchOutputMetrics,
} from './stitchUtils';
import type { StitchRenderJob, StitchRenderResult } from './types';

export type ActiveTask = { cancel: () => void };
export type WorkerSuccess = { blob: Blob; width: number; height: number };

export const buildRequestId = (): string => `stitch-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

type DirectoryPicker = (options?: { id?: string; mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;

export const getDirectoryPicker = (): DirectoryPicker | null => {
  if (typeof window === 'undefined') return null;
  const picker = (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker;
  return typeof picker === 'function' ? picker as DirectoryPicker : null;
};

export const canUseDirectoryPicker = (): boolean => getDirectoryPicker() !== null;

export const loadImageWithDecode = async (file: File): Promise<HTMLImageElement> => {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImageFromSource(objectUrl).catch(() => {
      throw new Error('stitch.error.loadImage');
    });
    const decodeImage = (image as HTMLImageElement & { decode?: () => Promise<void> }).decode;
    if (typeof decodeImage === 'function') await decodeImage.call(image);
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

export const renderJobOnMainThread = async (job: StitchRenderJob, onProgress?: (progress: number) => void): Promise<WorkerSuccess> => {
  const outputMetrics = resolveStitchOutputMetrics(job.images, job.layoutMode, job.gap);
  const canvas = document.createElement('canvas');
  canvas.width = outputMetrics.width;
  canvas.height = outputMetrics.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('stitch.error.initCanvas');
  ctx.fillStyle = job.background;
  ctx.fillRect(0, 0, outputMetrics.width, outputMetrics.height);

  let cursorX = 0;
  let cursorY = 0;
  for (let index = 0; index < job.images.length; index += 1) {
    const input = job.images[index];
    if (!input) continue;
    const image = await loadImageWithDecode(input.file);
    const dims = getRotatedDimensions(input);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = dims.width;
    tempCanvas.height = dims.height;
    const tempContext = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!tempContext) throw new Error('stitch.error.initTempCanvas');
    tempContext.save();
    tempContext.translate(dims.width / 2, dims.height / 2);
    tempContext.rotate((input.rotation * Math.PI) / 180);
    if (input.rotation % 180 !== 0) tempContext.drawImage(image, -dims.height / 2, -dims.width / 2, dims.height, dims.width);
    else tempContext.drawImage(image, -dims.width / 2, -dims.height / 2, dims.width, dims.height);
    tempContext.restore();
    applyImageFiltersToContext(tempContext, dims.width, dims.height, input.filters);
    if (job.layoutMode === 'webtoon') {
      const drawX = calculateAxisOffset(outputMetrics.width, dims.width, job.alignMode);
      ctx.drawImage(tempCanvas, drawX, cursorY);
      cursorY += dims.height + job.gap;
    } else {
      const drawY = calculateAxisOffset(outputMetrics.height, dims.height, job.alignMode);
      ctx.drawImage(tempCanvas, cursorX, drawY);
      cursorX += dims.width + job.gap;
    }
    onProgress?.(((index + 1) / job.images.length) * 100);
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((nextBlob) => nextBlob ? resolve(nextBlob) : reject(new Error('stitch.error.generateBlob')), job.mimeType, job.mimeType === 'image/png' ? undefined : job.quality);
  });
  return { blob, width: outputMetrics.width, height: outputMetrics.height };
};

export const runRenderJob = (job: StitchRenderJob, onProgress?: (progress: number) => void): ActiveTask & { promise: Promise<WorkerSuccess> } => {
  if (typeof Worker === 'undefined') {
    let cancelled = false;
    return {
      cancel: () => { cancelled = true; },
      promise: renderJobOnMainThread(job, (progress) => { if (!cancelled) onProgress?.(progress); }).then((result) => {
        if (cancelled) throw new Error('stitch.error.cancelled');
        return result;
      }),
    };
  }

  const worker = new Worker(new URL('./stitchWorker.ts', import.meta.url), { type: 'module' });
  let settled = false;
  const promise = new Promise<WorkerSuccess>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<
      | { type: 'progress'; requestId: string; progress: number }
      | { type: 'result'; result: StitchRenderResult }
      | { type: 'error'; requestId: string; message: string }
    >) => {
      if (settled) return;
      if (event.data.type === 'progress') {
        onProgress?.(event.data.progress);
        return;
      }
      settled = true;
      if (event.data.type === 'result') resolve(event.data.result);
      else reject(new Error(event.data.message));
      worker.terminate();
    };
    worker.postMessage({ type: 'render', job });
    worker.onerror = () => {
      if (settled) return;
      settled = true;
      reject(new Error('stitch.error.workerFailed'));
      worker.terminate();
    };
  });
  return { cancel: () => { if (!settled) { settled = true; worker.terminate(); } }, promise };
};
