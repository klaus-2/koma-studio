import { describe, expect, it } from 'vitest';

import type {
  ExportPackageRequest,
  ExportWorkerResponse,
} from './exportPackageWorker';

interface CapturingWorkerScope {
  onmessage: ((event: MessageEvent<ExportPackageRequest>) => void) | null;
  postMessage: (response: ExportWorkerResponse) => void;
}

describe('exportPackageWorker (real module, same-thread driver)', () => {
  const runRequest = async (
    request: ExportPackageRequest,
  ): Promise<ExportWorkerResponse> => {
    const captured: ExportWorkerResponse[] = [];
    const scope: CapturingWorkerScope = {
      onmessage: null,
      postMessage: (response) => captured.push(response),
    };
    const workerModule = await import('./exportPackageWorker');
    workerModule.attachWorkerScopeForTest(scope);
    void workerModule;
    if (!scope.onmessage) throw new Error('worker did not register onmessage');
    scope.onmessage(new MessageEvent('message', { data: request }));
    for (let waited = 0; captured.length === 0 && waited < 5000; waited += 100) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return captured[0] as ExportWorkerResponse;
  };

  const zipRequest = (): ExportPackageRequest => ({
    kind: 'package',
    jobId: 1,
    bundleFormat: 'zip',
    scope: 'aio',
    outFormat: 'image/png',
    zipEntries: [
      { path: 'images/001-page.png', bytes: new Uint8Array(256).fill(9) },
      { path: 'texts/raw/001-page.txt', bytes: new TextEncoder().encode('hello') },
    ],
    createdAt: '2026-11-12T00:00:00.000Z',
    flags: {
      includeRawText: true,
      includeTranslatedText: false,
      includeInpaintedImage: false,
      includesTypographerSession: false,
    },
  });

  it('builds a real zip with manifest flags from the request', async () => {
    const { unzipSync } = await import('fflate');
    const response = await runRequest(zipRequest());
    expect(response.kind).toBe('package-success');
    if (response.kind !== 'package-success') return;
    expect(response.mimeType).toBe('application/zip');
    const files = unzipSync(new Uint8Array(response.blobBytes));
    expect(files['images/001-page.png']).toBeDefined();
    expect(files['texts/raw/001-page.txt']).toBeDefined();
    const manifest = JSON.parse(
      new TextDecoder().decode(files['manifest.json'] as Uint8Array),
    ) as { scope: string; includeRawText: boolean; files: string[] };
    expect(manifest.scope).toBe('aio');
    expect(manifest.includeRawText).toBe(true);
    expect(manifest.files).toContain('images/001-page.png');
    expect(manifest.files).toContain('texts/raw/001-page.txt');
    expect(files['manifest.json']).toBeDefined();
  });

  it('builds a real PDF from transferred page bytes', async () => {
    const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 11, 73, 68, 65, 84, 120, 218, 99, 96, 0, 2, 0, 0, 5, 0, 1, 233, 250, 220, 216, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
    const request: ExportPackageRequest = {
      kind: 'package',
      jobId: 7,
      bundleFormat: 'pdf',
      scope: 'typesetter',
      outFormat: 'image/png',
      zipEntries: [],
      pdfPages: [
        { sourceImageId: 'img-1', bytes: PNG_BYTES, isJpeg: false },
        { sourceImageId: 'img-2', bytes: PNG_BYTES, isJpeg: false },
      ],
      createdAt: '2026-11-12T00:00:00.000Z',
      flags: {
        includeRawText: false,
        includeTranslatedText: false,
        includeInpaintedImage: false,
        includesTypographerSession: false,
      },
    };
    const response = await runRequest(request);
    expect(response.kind).toBe('package-success');
    if (response.kind !== 'package-success') return;
    expect(response.mimeType).toBe('application/pdf');
    const bytes = new Uint8Array(response.blobBytes);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    const { PDFDocument } = await import('pdf-lib');
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(2);
  });
});
