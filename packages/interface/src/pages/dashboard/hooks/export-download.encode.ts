import { canvasToBlob } from '../../../utils/dashboard.rendering.utils';
import type { EncodeMimeType } from './exportEncodeWorker';
import {
  createExportEncodeWorkerPool,
  type ExportWorkerPool,
} from './exportWorkerPool';

const isEncodeMimeType = (value: string): value is EncodeMimeType =>
  value === 'image/png' || value === 'image/jpeg' || value === 'image/webp';

export const supportsWorkerEncode = (): boolean => {
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    return false;
  }
  try {
    return (
      typeof OffscreenCanvas.prototype.convertToBlob === 'function' &&
      typeof ImageData === 'function'
    );
  } catch {
    return false;
  }
};

let sharedEncodePool: ExportWorkerPool | null = null;
const getEncodePool = (): ExportWorkerPool => {
  sharedEncodePool ??= createExportEncodeWorkerPool();
  return sharedEncodePool;
};

const encodeCanvasInPool = async (
  canvas: HTMLCanvasElement,
  mimeType: EncodeMimeType,
  quality: number,
): Promise<Blob | null> => {
  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }
  const width = canvas.width;
  const height = canvas.height;
  if (width < 1 || height < 1) {
    return null;
  }
  const imageData = context.getImageData(0, 0, width, height);
  const buffer = imageData.data.buffer;
  if (!(buffer instanceof ArrayBuffer)) {
    return null;
  }
  const result = await getEncodePool().encode({
    pixels: buffer,
    width,
    height,
    mimeType,
    quality,
  });
  return new Blob([result.blobBytes], { type: result.mimeType });
};

export const encodeCanvasToBlob = async (
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
): Promise<Blob> => {
  if (supportsWorkerEncode() && isEncodeMimeType(mimeType)) {
    try {
      const encoded = await encodeCanvasInPool(canvas, mimeType, quality);
      if (encoded !== null) {
        return encoded;
      }
    } catch (error) {
      console.warn(
        '[export-encode] worker encode failed; falling back to main thread',
        error,
      );
    }
  }
  return canvasToBlob(canvas, mimeType, quality);
};
