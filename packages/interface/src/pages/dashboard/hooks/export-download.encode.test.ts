import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ExportEncodeJobSpec, ExportWorkerPool } from './exportWorkerPool';
import { encodeCanvasToBlob } from './export-download.encode';

const { canvasToBlobMock, encodeMock } = vi.hoisted(() => ({
  canvasToBlobMock: vi.fn(
    (_canvas: HTMLCanvasElement, type: string, _quality: number) =>
      Promise.resolve(new Blob(['main-thread'], { type })),
  ),
  encodeMock: vi.fn((_spec: ExportEncodeJobSpec) =>
    Promise.resolve({
      blobBytes: new Uint8Array([7, 7]).buffer,
      mimeType: 'image/png',
    }),
  ),
}));

vi.mock('../../../utils/dashboard.rendering.utils', () => ({
  canvasToBlob: canvasToBlobMock,
}));

vi.mock('./exportWorkerPool', () => ({
  createExportEncodeWorkerPool: (): ExportWorkerPool => {
    const fake: ExportWorkerPool = {
      package: () => Promise.reject(new Error('package jobs are not used here')),
      encode: (spec: ExportEncodeJobSpec) => encodeMock(spec),
      get size(): number {
        return 1;
      },
      pendingCount: () => 0,
      dispose: () => undefined,
    };
    return fake;
  },
}));

const makePageCanvas = (
  imageData: { data: Uint8ClampedArray } | null,
): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 2;
  const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
  getContextSpy.mockReturnValue(
    imageData === null
      ? null
      : ({
          getImageData: vi.fn(() => imageData),
        } as unknown as CanvasRenderingContext2D),
  );
  return canvas;
};

const stubOffscreenAvailable = (): void => {
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      convertToBlob(): Promise<Blob> {
        return Promise.reject(new Error('unused in bridge tests'));
      }
    },
  );
  vi.stubGlobal(
    'ImageData',
    class {
      constructor(
        data: Uint8ClampedArray,
        width: number,
        height: number,
      ) {
        void data;
        void width;
        void height;
      }
    },
  );
  vi.stubGlobal('Worker', class {});
};

beforeEach(() => {
  canvasToBlobMock.mockClear();
  encodeMock.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('encodeCanvasToBlob (Fase C C6 — pool encode with main-thread fallback)', () => {
  it('falls back to the main-thread encode when OffscreenCanvas is unavailable', async () => {
    const canvas = makePageCanvas(null);

    const blob = await encodeCanvasToBlob(canvas, 'image/png', 1);

    expect(blob.type).toBe('image/png');
    expect(encodeMock).not.toHaveBeenCalled();
    expect(canvasToBlobMock).toHaveBeenCalledWith(canvas, 'image/png', 1);
  });

  it('encodes through the pool when workers are available', async () => {
    stubOffscreenAvailable();
    const pixels = new Uint8ClampedArray(new ArrayBuffer(16));
    const canvas = makePageCanvas({ data: pixels });

    const blob = await encodeCanvasToBlob(canvas, 'image/webp', 0.9);

    expect(blob.type).toBe('image/png');
    expect(canvasToBlobMock).not.toHaveBeenCalled();
    expect(encodeMock).toHaveBeenCalledTimes(1);
    const spec = encodeMock.mock.calls[0]?.[0];
    expect(spec?.width).toBe(2);
    expect(spec?.height).toBe(2);
    expect(spec?.mimeType).toBe('image/webp');
    expect(spec?.quality).toBe(0.9);
    expect(spec?.pixels).toBe(pixels.buffer);
  });

  it('falls back to the main-thread encode when the pool rejects', async () => {
    stubOffscreenAvailable();
    encodeMock.mockRejectedValueOnce(new Error('worker died'));
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const canvas = makePageCanvas({
      data: new Uint8ClampedArray(new ArrayBuffer(16)),
    });

    try {
      const blob = await encodeCanvasToBlob(canvas, 'image/png', 1);

      expect(blob.type).toBe('image/png');
      expect(canvasToBlobMock).toHaveBeenCalledWith(canvas, 'image/png', 1);
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('falls back without touching the pool when pixels cannot be extracted', async () => {
    stubOffscreenAvailable();
    const canvas = makePageCanvas(null);

    const blob = await encodeCanvasToBlob(canvas, 'image/png', 1);

    expect(blob.type).toBe('image/png');
    expect(encodeMock).not.toHaveBeenCalled();
    expect(canvasToBlobMock).toHaveBeenCalledWith(canvas, 'image/png', 1);
  });

  it('keeps the main-thread encode for unsupported mime types', async () => {
    stubOffscreenAvailable();
    const canvas = makePageCanvas({
      data: new Uint8ClampedArray(new ArrayBuffer(16)),
    });

    const blob = await encodeCanvasToBlob(canvas, 'image/gif', 1);

    expect(blob.type).toBe('image/gif');
    expect(encodeMock).not.toHaveBeenCalled();
    expect(canvasToBlobMock).toHaveBeenCalledWith(canvas, 'image/gif', 1);
  });

  it('propagates the failure when both the pool and the main-thread encode fail', async () => {
    stubOffscreenAvailable();
    encodeMock.mockRejectedValueOnce(new Error('worker died'));
    canvasToBlobMock.mockRejectedValueOnce(
      new Error('main-thread encode failed'),
    );
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const canvas = makePageCanvas({
      data: new Uint8ClampedArray(new ArrayBuffer(16)),
    });

    try {
      await expect(encodeCanvasToBlob(canvas, 'image/png', 1)).rejects.toThrow(
        'main-thread encode failed',
      );
    } finally {
      warnSpy.mockRestore();
    }
  });
});
