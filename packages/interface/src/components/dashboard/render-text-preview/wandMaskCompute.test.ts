import { afterEach, describe, expect, it } from 'vitest';
import { computeWandMaskBuffers } from './wandMaskCompute';
import {
  computeWandMaskBuffersOffThread,
  resetWandMaskWorkerForTest,
} from './wandMaskWorkerClient';

describe('computeWandMaskBuffers', () => {
  it('computes selection, border marching-ants dash phases, and interior stripes', () => {
    const width = 4;
    const height = 4;
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let y = 1; y <= 2; y += 1) {
      for (let x = 1; x <= 2; x += 1) {
        const offset = (y * width + x) * 4;
        rgba[offset] = 255;
        rgba[offset + 3] = 255;
      }
    }

    const buffers = computeWandMaskBuffers(rgba, width, height);
    expect(Array.from(buffers.selected)).toEqual([
      0, 0, 0, 0,
      0, 1, 1, 0,
      0, 1, 1, 0,
      0, 0, 0, 0,
    ]);

    const borderPixelOffset = (1 * width + 1) * 4;
    expect(buffers.frameAData[borderPixelOffset + 3]).toBe(255);
    expect(buffers.frameBData[borderPixelOffset + 3]).toBe(255);
    expect(buffers.frameAData[borderPixelOffset]).toBe(255);
    expect(buffers.frameBData[borderPixelOffset]).toBe(12);

    const unselectedOffset = 0;
    expect(buffers.frameAData[unselectedOffset + 3]).toBe(0);
    expect(buffers.frameBData[unselectedOffset + 3]).toBe(0);
  });

  it('handles an empty mask cleanly', () => {
    const buffers = computeWandMaskBuffers(new Uint8ClampedArray(3 * 3 * 4), 3, 3);
    expect(buffers.selected.every((v) => v === 0)).toBe(true);
    expect(buffers.frameAData.every((v) => v === 0)).toBe(true);
    expect(buffers.frameBData.every((v) => v === 0)).toBe(true);
  });
});

describe('computeWandMaskBuffersOffThread', () => {
  const originalWorker = globalThis.Worker;

  afterEach(() => {
    resetWandMaskWorkerForTest();
    Reflect.set(globalThis, 'Worker', originalWorker);
  });

  it('falls back synchronously when Worker is unavailable', async () => {
    Reflect.set(globalThis, 'Worker', undefined);
    const rgba = new Uint8ClampedArray(2 * 2 * 4);
    rgba[3] = 255;
    const buffers = await computeWandMaskBuffersOffThread(rgba, 2, 2);
    expect(buffers.selected[0]).toBe(1);
    expect(buffers.selected[1]).toBe(0);
  });

  it('rejects immediately when AbortSignal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      computeWandMaskBuffersOffThread(new Uint8ClampedArray(16), 2, 2, controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('dispatches work to Worker and resolves returned buffers', async () => {
    class MockWorker {
      private listeners = new Map<string, Array<(event: Event) => void>>();
      terminated = false;

      addEventListener(type: string, listener: (event: Event) => void): void {
        const list = this.listeners.get(type) ?? [];
        list.push(listener);
        this.listeners.set(type, list);
      }

      postMessage(message: { jobId: number; width: number; height: number; rgba: Uint8ClampedArray }): void {
        const result = computeWandMaskBuffers(message.rgba, message.width, message.height);
        const event = new MessageEvent('message', {
          data: {
            jobId: message.jobId,
            ok: true,
            width: result.width,
            height: result.height,
            selected: result.selected,
            frameAData: result.frameAData,
            frameBData: result.frameBData,
          },
        });
        for (const listener of this.listeners.get('message') ?? []) {
          listener(event);
        }
      }

      terminate(): void {
        this.terminated = true;
      }
    }

    Reflect.set(globalThis, 'Worker', MockWorker);
    const rgba = new Uint8ClampedArray(2 * 2 * 4);
    rgba[4 + 3] = 255;
    const buffers = await computeWandMaskBuffersOffThread(rgba, 2, 2);
    expect(buffers.selected[0]).toBe(0);
    expect(buffers.selected[1]).toBe(1);
  });
});
