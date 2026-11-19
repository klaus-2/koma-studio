import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  computeZoomCorrectedScrollTop,
  resolveFocusSignal,
  useRegionFocusScroll,
  useRegionFocusSignal,
} from './useRegionFocusScroll';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useUiShellStore } from '../stores/ui-shell-store';

type FrameCallback = (time: number) => void;

const installRafQueue = (): {
  flush: (frames: number) => Promise<void>;
  queuedCount: () => number;
} => {
  const queue: FrameCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameCallback) => {
    queue.push(callback);
    return queue.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  return {
    flush: async (frames: number) => {
      for (let frame = 0; frame < frames; frame += 1) {
        const pending = queue.splice(0);
        for (const callback of pending) callback(performance.now());
        for (let hop = 0; hop < 4; hop += 1) await Promise.resolve();
      }
    },
    queuedCount: (): number => queue.length,
  };
};

const asRect = (box: {
  top: number;
  left: number;
  width: number;
  height: number;
}): DOMRect =>
  ({
    top: box.top,
    left: box.left,
    width: box.width,
    height: box.height,
    bottom: box.top + box.height,
    right: box.left + box.width,
    x: box.left,
    y: box.top,
    toJSON: () => ({}),
  }) as DOMRect;

describe('computeZoomCorrectedScrollTop', () => {
  const buildContainer = (scrollTop: number): HTMLElement => {
    const element = document.createElement('div');
    Object.defineProperty(element, 'scrollTop', {
      configurable: true,
      value: scrollTop,
      writable: true,
    });
    return element;
  };

  it('centers the region at zoom 1', () => {
    const container = buildContainer(100);
    const result = computeZoomCorrectedScrollTop({
      container,
      regionRect: asRect({ top: -100, left: 0, width: 200, height: 120 }),
      containerRect: asRect({ top: -100, left: 0, width: 800, height: 600 }),
      zoom: 1,
    });
    expect(result).toBeCloseTo(-140, 5);
  });

  it('compensates CSS zoom 0.5 (visual delta ÷ zoom)', () => {
    const container = buildContainer(0);
    const result = computeZoomCorrectedScrollTop({
      container,
      regionRect: asRect({ top: -100, left: 0, width: 200, height: 120 }),
      containerRect: asRect({ top: 0, left: 0, width: 800, height: 600 }),
      zoom: 0.5,
    });
    expect(result).toBeCloseTo(-680, 5);
  });

  it('compensates CSS zoom 1.5', () => {
    const container = buildContainer(50);
    const result = computeZoomCorrectedScrollTop({
      container,
      regionRect: asRect({ top: -100, left: 0, width: 200, height: 120 }),
      containerRect: asRect({ top: -50, left: 0, width: 800, height: 600 }),
      zoom: 1.5,
    });
    expect(result).toBeCloseTo(50 + -290 / 1.5, 5);
  });

  it('guards against a non-positive or non-finite zoom', () => {
    const container = buildContainer(0);
    const regionRect = asRect({ top: 0, left: 0, width: 200, height: 120 });
    const containerRect = asRect({ top: 0, left: 0, width: 800, height: 600 });
    expect(
      computeZoomCorrectedScrollTop({ container, regionRect, containerRect, zoom: 0 }),
    ).toBeCloseTo(-240, 5);
    expect(
      computeZoomCorrectedScrollTop({
        container,
        regionRect,
        containerRect,
        zoom: Number.NaN,
      }),
    ).toBeCloseTo(-240, 5);
  });
});

describe('resolveFocusSignal', () => {
  const images = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('resolves the strip index for a known image', () => {
    expect(resolveFocusSignal(images, 'b', 1)).toEqual({ index: 1, nonce: 1 });
  });

  it('returns null for an unknown image', () => {
    expect(resolveFocusSignal(images, 'missing', 1)).toBeNull();
  });
});

describe('focus signal: emit → useRegionFocusSignal (integration)', () => {
  let raf: ReturnType<typeof installRafQueue>;

  beforeEach(() => {
    raf = installRafQueue();
    useImageCollectionStore.setState({
      images: [
        {
          id: 'img',
          file: {
            kind: 'direct',
            name: 'page.png',
            type: 'image/png',
            size: 0,
            lastModified: 0,
            resident: new File([], 'page.png'),
            toBlob: async () => new Blob(),
            dimensions: async () => ({ width: 100, height: 40 }),
            release: () => {},
          },
          url: 'blob:img',
          width: 100,
          height: 40,
          rotation: 0,
          filters: {
            brightness: 1,
            contrast: 1,
            saturation: 1,
            sharpen: 0,
            levels: { black: 0, white: 255, gamma: 1 },
            grayscale: false,
            inverted: false,
          },
        },
      ],
      activeId: 'img',
    });
  });

  it('delivers the emitted {index, nonce} to a useRegionFocusSignal consumer', async () => {
    const { result } = renderHook(() => useRegionFocusSignal());
    const before = result.current;

    const { result: scrollApi } = renderHook(() => useRegionFocusScroll());
    await act(async () => {
      void scrollApi.current.focusRegion({ imageId: 'img', regionId: 'r-signal' });
    });
    await raf.flush(3);

    const delivered = result.current;
    expect(delivered).toEqual({ index: 0, nonce: 1 });
    expect(delivered).not.toBe(before);
  });
});

describe('useRegionFocusScroll.focusRegion', () => {
  let raf: ReturnType<typeof installRafQueue>;
  beforeEach(() => {
    raf = installRafQueue();
    useUiShellStore.setState({ zoom: 1, processing: false });
    useImageCollectionStore.setState({
      images: [
        {
          id: 'img',
          file: {
            kind: 'direct',
            name: 'page.png',
            type: 'image/png',
            size: 0,
            lastModified: 0,
            resident: new File([], 'page.png'),
            toBlob: async () => new Blob(),
            dimensions: async () => ({ width: 100, height: 40 }),
            release: () => {},
          },
          url: 'blob:img',
          width: 100,
          height: 40,
          rotation: 0,
          filters: {
            brightness: 1,
            contrast: 1,
            saturation: 1,
            sharpen: 0,
            levels: { black: 0, white: 255, gamma: 1 },
            grayscale: false,
            inverted: false,
          },
        },
      ],
      activeId: 'img',
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  const mountScrollable = (): HTMLElement => {
    const container = document.createElement('div');
    container.style.overflowY = 'auto';
    Object.defineProperty(container, 'scrollTop', {
      configurable: true,
      value: 0,
      writable: true,
    });
    Object.defineProperty(container, 'scrollHeight', {
      configurable: true,
      value: 5000,
    });
    Object.defineProperty(container, 'clientHeight', {
      configurable: true,
      value: 600,
    });
    container.getBoundingClientRect = () =>
      asRect({ top: 0, left: 0, width: 800, height: 600 });
    document.body.appendChild(container);
    return container;
  };

  const mountStripItem = (index: number): HTMLElement => {
    const container = mountScrollable();
    const item = document.createElement('div');
    item.setAttribute('data-long-strip-index', String(index));
    container.appendChild(item);
    return item;
  };

  const mountRegionOverlay = (
    item: HTMLElement,
    regionId: string,
  ): HTMLElement => {
    const overlay = document.createElement('div');
    overlay.setAttribute('data-region-id', regionId);
    overlay.getBoundingClientRect = () =>
      asRect({ top: -100, left: 0, width: 200, height: 120 });
    item.appendChild(overlay);
    return overlay;
  };

  it('applies the zoom-corrected centering to the strip container', async () => {
    const item = mountStripItem(2);
    mountRegionOverlay(item, 'r1');
    const container = item.parentElement as HTMLElement;

    const { result } = renderHook(() => useRegionFocusScroll());
    await act(async () => {
      void result.current.focusRegion({ imageId: 'img', regionId: 'r1' });
    });
    await raf.flush(3);

    expect(container.scrollTop).toBeCloseTo(-340, 5);
  });

  it('retries once when the region overlay is not mounted yet', async () => {
    const item = mountStripItem(0);
    const container = item.parentElement as HTMLElement;

    const { result } = renderHook(() => useRegionFocusScroll());
    await act(async () => {
      void result.current.focusRegion({ imageId: 'img', regionId: 'r2' });
    });
    await raf.flush(2);
    expect(container.scrollTop).toBe(0);

    mountRegionOverlay(item, 'r2');
    await raf.flush(1);

    expect(container.scrollTop).toBeCloseTo(-340, 5);
  });

  it('gives up without scrolling when the overlay never mounts', async () => {
    const item = mountStripItem(0);
    const container = item.parentElement as HTMLElement;

    const { result } = renderHook(() => useRegionFocusScroll());
    await act(async () => {
      void result.current.focusRegion({ imageId: 'img', regionId: 'r3' });
    });
    await raf.flush(4);

    expect(container.scrollTop).toBe(0);
  });

  it('does nothing for an image outside the collection', async () => {
    const { result } = renderHook(() => useRegionFocusScroll());
    await act(async () => {
      void result.current.focusRegion({ imageId: 'ghost', regionId: 'r4' });
    });
    await raf.flush(4);
    expect(document.querySelector('[data-region-id="r4"]')).toBeNull();
  });
});
