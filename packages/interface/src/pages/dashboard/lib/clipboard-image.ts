import { desktopBridge } from '@/lib/desktop-bridge';
import { canvasToBlob } from '@/utils/dashboard.utils';
import type { TypographyBounds } from '@/typography/types';

export const hasClipboardImageBridge = (): boolean =>
  desktopBridge.desktop?.clipboard !== undefined;

const decodeToCanvas = async (blob: Blob): Promise<HTMLCanvasElement> => {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('Failed to acquire a 2D canvas context for the clipboard image.');
  }
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
};

export const copyImageBlobToClipboard = async (blob: Blob): Promise<void> => {
  const bridge = desktopBridge.desktop;
  if (!bridge?.clipboard) {
    throw new Error('The desktop shell has no clipboard image integration.');
  }
  const canvas = await decodeToCanvas(blob);
  const png = await canvasToBlob(canvas, 'image/png', 1);
  const data = await png.arrayBuffer();
  await bridge.clipboard.writeImage({ data, mimeType: 'image/png' });
};

export const cropImageBlob = async (
  blob: Blob,
  bbox: TypographyBounds,
): Promise<Blob> => {
  const bitmap = await createImageBitmap(blob);
  const left = Math.max(0, Math.floor(Math.min(bbox[0], bbox[2])));
  const top = Math.max(0, Math.floor(Math.min(bbox[1], bbox[3])));
  const right = Math.min(bitmap.width, Math.ceil(Math.max(bbox[0], bbox[2])));
  const bottom = Math.min(bitmap.height, Math.ceil(Math.max(bbox[1], bbox[3])));
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) {
    bitmap.close();
    throw new Error('The selected region is outside the page bounds.');
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('Failed to acquire a 2D canvas context for the clipboard image.');
  }
  context.drawImage(bitmap, left, top, width, height, 0, 0, width, height);
  bitmap.close();
  return canvasToBlob(canvas, 'image/png', 1);
};
