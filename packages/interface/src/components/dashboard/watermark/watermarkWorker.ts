import { renderWatermarkAsset } from './watermarkRenderer';
import type { WatermarkRenderAsset } from './watermarkTypes';

interface WatermarkWorkerRequest {
  id: string;
  asset: WatermarkRenderAsset;
}

interface WatermarkWorkerSuccess {
  id: string;
  ok: true;
  blob: Blob;
  width: number;
  height: number;
  resolvedAnchor: string;
}

interface WatermarkWorkerFailure {
  id: string;
  ok: false;
  error: string;
}

self.onmessage = async (event: MessageEvent<WatermarkWorkerRequest>) => {
  const { id, asset } = event.data;
  if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap !== 'function') {
    const failure: WatermarkWorkerFailure = {
      id,
      ok: false,
      error: 'The watermark worker is unavailable in this environment.',
    };
    self.postMessage(failure);
    return;
  }

  try {
    const result = await renderWatermarkAsset(asset);
    const success: WatermarkWorkerSuccess = {
      id,
      ok: true,
      blob: result.blob,
      width: result.width,
      height: result.height,
      resolvedAnchor: result.resolvedAnchor,
    };
    self.postMessage(success);
  } catch (error) {
    const failure: WatermarkWorkerFailure = {
      id,
      ok: false,
      error: error instanceof Error ? error.message : 'Watermark worker failed.',
    };
    self.postMessage(failure);
  }
};

// oxlint-disable-next-line no-useless-empty-export -- keeps the worker as an ES module (self is typed)
export {};
