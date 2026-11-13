/// <reference lib="webworker" />

import { strToU8, zipSync } from 'fflate';

export interface WorkerZipEntry {
  readonly path: string;
  readonly bytes: Uint8Array;
}

export interface WorkerPdfPage {
  readonly sourceImageId: string;
  readonly bytes: Uint8Array;
  readonly isJpeg: boolean;
}

export interface ExportPackageRequest {
  readonly kind: 'package';
  readonly jobId: number;
  readonly bundleFormat: 'zip' | 'cbz' | 'cb7' | 'pdf';
  readonly scope: string;
  readonly outFormat: string;
  readonly zipEntries: readonly WorkerZipEntry[];
  readonly pdfPages?: readonly WorkerPdfPage[];
  readonly createdAt: string;
  readonly flags: {
    readonly includeRawText: boolean;
    readonly includeTranslatedText: boolean;
    readonly includeInpaintedImage: boolean;
    readonly includesTypographerSession: boolean;
  };
}

export interface ExportPackageSuccess {
  readonly kind: 'package-success';
  readonly jobId: number;
  readonly blobBytes: ArrayBuffer;
  readonly mimeType: string;
}

export interface ExportPackageFailure {
  readonly kind: 'package-failure';
  readonly jobId: number;
  readonly message: string;
}

export type ExportWorkerRequest = ExportPackageRequest;
export type ExportWorkerResponse = ExportPackageSuccess | ExportPackageFailure;

const buildZipBlob = (
  request: ExportPackageRequest,
): { blob: Blob; mimeType: string } => {
  const zipFiles: Record<string, Uint8Array> = {};
  for (const entry of request.zipEntries) {
    zipFiles[entry.path] = entry.bytes;
  }
  zipFiles['manifest.json'] = strToU8(JSON.stringify({
    scope: request.scope,
    bundleFormat: request.bundleFormat,
    imageFormat: request.outFormat,
    createdAt: request.createdAt,
    includeRawText: request.flags.includeRawText,
    includeTranslatedText: request.flags.includeTranslatedText,
    includeInpaintedImage: request.flags.includeInpaintedImage,
    includesTypographerSession: request.flags.includesTypographerSession,
    files: Object.keys(zipFiles).sort(),
  }, null, 2));

  const zipped = zipSync(zipFiles, { level: 6 });
  const copy = new Uint8Array(zipped.byteLength);
  copy.set(zipped);
  return {
    blob: new Blob([copy.buffer], { type: 'application/zip' }),
    mimeType: 'application/zip',
  };
};

const buildPdfBlob = async (
  request: ExportPackageRequest,
): Promise<{ blob: Blob; mimeType: string }> => {
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  for (const page of request.pdfPages ?? []) {
    const embedded = page.isJpeg
      ? await pdf.embedJpg(page.bytes)
      : await pdf.embedPng(page.bytes);
    const pdfPage = pdf.addPage([embedded.width, embedded.height]);
    pdfPage.drawImage(embedded, {
      x: 0,
      y: 0,
      width: embedded.width,
      height: embedded.height,
    });
  }
  const pdfBytes = await pdf.save();
  const pdfBytesCopy = new Uint8Array(pdfBytes.byteLength);
  pdfBytesCopy.set(pdfBytes);
  return {
    blob: new Blob([pdfBytesCopy.buffer], { type: 'application/pdf' }),
    mimeType: 'application/pdf',
  };
};

let messageTarget: {
  onmessage: ((event: MessageEvent<ExportWorkerRequest>) => void) | null;
  postMessage: (response: ExportWorkerResponse) => void;
} = self as unknown as {
  onmessage: ((event: MessageEvent<ExportWorkerRequest>) => void) | null;
  postMessage: (response: ExportWorkerResponse) => void;
};

export const attachWorkerScopeForTest = (
  scope: {
    onmessage: ((event: MessageEvent<ExportWorkerRequest>) => void) | null;
    postMessage: (response: ExportWorkerResponse) => void;
  } | null,
): void => {
  messageTarget = scope ?? (self as unknown as typeof messageTarget);
  messageTarget.onmessage = handleWorkerMessage;
};

function handleWorkerMessage(event: MessageEvent<ExportWorkerRequest>): void {
  const request = event.data;
  if (request.kind !== 'package') return;
  void (async () => {
    try {
      const result =
        request.bundleFormat === 'pdf'
          ? await buildPdfBlob(request)
          : buildZipBlob(request);
      const bytes = await result.blob.arrayBuffer();
      const response: ExportPackageSuccess = {
        kind: 'package-success',
        jobId: request.jobId,
        blobBytes: bytes,
        mimeType: result.mimeType,
      };
      messageTarget.postMessage(response);
    } catch (error) {
      const response: ExportPackageFailure = {
        kind: 'package-failure',
        jobId: request.jobId,
        message: error instanceof Error ? error.message : String(error),
      };
      messageTarget.postMessage(response);
    }
  })();
}

messageTarget.onmessage = handleWorkerMessage;
