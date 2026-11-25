/// <reference lib="webworker" />

import { computeWandMaskBuffers } from './wandMaskCompute';

export interface WandMaskWorkerRequest {
  readonly jobId: number;
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8ClampedArray;
}

export type WandMaskWorkerResponse =
  | {
      readonly jobId: number;
      readonly ok: true;
      readonly width: number;
      readonly height: number;
      readonly selected: Uint8Array;
      readonly frameAData: Uint8ClampedArray;
      readonly frameBData: Uint8ClampedArray;
    }
  | {
      readonly jobId: number;
      readonly ok: false;
      readonly message: string;
    };

const isWandMaskRequest = (value: unknown): value is WandMaskWorkerRequest => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const jobId = Reflect.get(value, 'jobId');
  const width = Reflect.get(value, 'width');
  const height = Reflect.get(value, 'height');
  const rgba = Reflect.get(value, 'rgba');
  return (
    typeof jobId === 'number' &&
    typeof width === 'number' &&
    typeof height === 'number' &&
    rgba instanceof Uint8ClampedArray
  );
};

const postWorkerMessage = (
  response: WandMaskWorkerResponse,
  transfer: Transferable[],
): void => {
  const scope: object = globalThis;
  const rawPostMessage = Reflect.get(scope, 'postMessage');
  if (typeof rawPostMessage === 'function') {
    Reflect.apply(rawPostMessage, scope, [response, transfer]);
  }
};

export const handleWandMaskWorkerPayload = (payload: unknown): void => {
  if (!isWandMaskRequest(payload)) {
    return;
  }
  try {
    const buffers = computeWandMaskBuffers(
      payload.rgba,
      payload.width,
      payload.height,
    );
    postWorkerMessage(
      {
        jobId: payload.jobId,
        ok: true,
        width: buffers.width,
        height: buffers.height,
        selected: buffers.selected,
        frameAData: buffers.frameAData,
        frameBData: buffers.frameBData,
      },
      [
        buffers.selected.buffer,
        buffers.frameAData.buffer,
        buffers.frameBData.buffer,
      ],
    );
  } catch (error: unknown) {
    postWorkerMessage(
      {
        jobId: payload.jobId,
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      },
      [],
    );
  }
};

Reflect.set(
  globalThis,
  'onmessage',
  (event: MessageEvent<unknown>): void => {
    handleWandMaskWorkerPayload(event.data);
  },
);
