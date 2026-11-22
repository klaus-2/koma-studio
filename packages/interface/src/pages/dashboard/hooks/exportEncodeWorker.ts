/// <reference lib="webworker" />

export type EncodeMimeType = 'image/png' | 'image/jpeg' | 'image/webp';

export interface ExportEncodeRequest {
  readonly kind: 'encode';
  readonly jobId: number;
  readonly pixels: ArrayBuffer;
  readonly width: number;
  readonly height: number;
  readonly mimeType: EncodeMimeType;
  readonly quality: number;
}

export interface ExportEncodeSuccess {
  readonly kind: 'encode-success';
  readonly jobId: number;
  readonly blobBytes: ArrayBuffer;
  readonly mimeType: string;
}

export interface ExportEncodeFailure {
  readonly kind: 'encode-failure';
  readonly jobId: number;
  readonly message: string;
}

export type ExportEncodeWorkerResponse =
  | ExportEncodeSuccess
  | ExportEncodeFailure;

const isEncodeMimeType = (value: string): value is EncodeMimeType =>
  value === 'image/png' || value === 'image/jpeg' || value === 'image/webp';

const encodePixels = async (
  request: ExportEncodeRequest,
): Promise<{ blob: Blob; mimeType: string }> => {
  if (!isEncodeMimeType(request.mimeType)) {
    throw new Error(`unsupported encode mime type: ${request.mimeType}`);
  }
  if (request.width < 1 || request.height < 1) {
    throw new Error('encode requires a positive canvas size');
  }
  const canvas = new OffscreenCanvas(request.width, request.height);
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('OffscreenCanvas 2d context unavailable');
  }
  context.putImageData(
    new ImageData(
      new Uint8ClampedArray(request.pixels),
      request.width,
      request.height,
    ),
    0,
    0,
  );
  const blob = await canvas.convertToBlob({
    type: request.mimeType,
    quality: request.quality,
  });
  return { blob, mimeType: request.mimeType };
};

let messageTarget: {
  onmessage: ((event: MessageEvent<ExportEncodeRequest>) => void) | null;
  postMessage: (response: ExportEncodeWorkerResponse) => void;
} = self as unknown as {
  onmessage: ((event: MessageEvent<ExportEncodeRequest>) => void) | null;
  postMessage: (response: ExportEncodeWorkerResponse) => void;
};

export const attachWorkerScopeForTest = (
  scope: {
    onmessage: ((event: MessageEvent<ExportEncodeRequest>) => void) | null;
    postMessage: (response: ExportEncodeWorkerResponse) => void;
  } | null,
): void => {
  messageTarget = scope ?? (self as unknown as typeof messageTarget);
  messageTarget.onmessage = handleWorkerMessage;
};

function handleWorkerMessage(event: MessageEvent<ExportEncodeRequest>): void {
  const request = event.data;
  if (request.kind !== 'encode') return;
  void (async () => {
    try {
      const result = await encodePixels(request);
      const bytes = await result.blob.arrayBuffer();
      const response: ExportEncodeSuccess = {
        kind: 'encode-success',
        jobId: request.jobId,
        blobBytes: bytes,
        mimeType: result.mimeType,
      };
      messageTarget.postMessage(response);
    } catch (error) {
      const response: ExportEncodeFailure = {
        kind: 'encode-failure',
        jobId: request.jobId,
        message: error instanceof Error ? error.message : String(error),
      };
      messageTarget.postMessage(response);
    }
  })();
}

messageTarget.onmessage = handleWorkerMessage;
