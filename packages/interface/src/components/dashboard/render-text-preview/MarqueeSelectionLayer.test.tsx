// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import MarqueeSelectionLayer from './MarqueeSelectionLayer';
import { useImageCollectionStore } from '@/pages/dashboard/stores/image-collection-store';
import { useTypographerStore } from '@/pages/dashboard/stores/typographer-store';
import { useUiShellStore } from '@/pages/dashboard/stores/ui-shell-store';
import type { AioTextRegion, ToolMode } from '../../../types/dashboard.types';

const region = (
  id: string,
  bbox: [number, number, number, number],
): AioTextRegion => ({
  id,
  bbox,
  score: 1,
  source: 'model',
  modelKey: 'font_rtdetr_v2',
});

const regions = [
  region('r-a', [0, 0, 50, 50]),
  region('r-b', [60, 0, 110, 50]),
  region('r-c', [0, 60, 50, 110]),
];

// jsdom rects are zero-sized: map every element to a 100x100 CSS box so
// clientX/clientY == image space for the 100x100 test image.
const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;

const installPointerCaptureStub = (): void => {
  if (typeof Element.prototype.setPointerCapture !== 'function') {
    Element.prototype.setPointerCapture = () => undefined;
  }
  if (typeof Element.prototype.releasePointerCapture !== 'function') {
    Element.prototype.releasePointerCapture = () => undefined;
  }
};

const pointer = (
  node: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  coords: { clientX?: number; clientY?: number } = {},
): void => {
  fireEvent(
    node,
    new MouseEvent(type, {
      bubbles: true,
      button: 0,
      clientX: coords.clientX ?? 0,
      clientY: coords.clientY ?? 0,
    }),
  );
};

const renderLayer = (
  overrides: {
    regions?: readonly AioTextRegion[];
    areaSelectionEnabled?: boolean;
    marqueeImageId?: string | null;
    tool?: 'select' | 'draw-square' | 'draw-rounded' | 'marquee';
    mode?: ToolMode;
    wrapperHandlers?: {
      onPointerDown?: () => void;
      onPointerMove?: () => void;
      onPointerUp?: () => void;
    };
  } = {},
): HTMLElement => {
  useTypographerStore.setState({
    typographerSelectionTool: overrides.tool ?? 'marquee',
  });
  // The layer mounts only inside the typesetter stage (the global tool
  // leaks across stage items, which would swallow their pointer events).
  useUiShellStore.setState({ mode: overrides.mode ?? 'typesetter' });
  useImageCollectionStore.setState({
    images: [],
    activeId: overrides.marqueeImageId ?? 'img-1',
  });
  const { container } = render(
    <div
      onPointerDown={overrides.wrapperHandlers?.onPointerDown}
      onPointerMove={overrides.wrapperHandlers?.onPointerMove}
      onPointerUp={overrides.wrapperHandlers?.onPointerUp}
    >
      <MarqueeSelectionLayer
        regions={overrides.regions ?? regions}
        imageWidth={100}
        imageHeight={100}
        areaSelectionEnabled={overrides.areaSelectionEnabled ?? true}
        marqueeImageId={
          overrides.marqueeImageId === undefined
            ? 'img-1'
            : overrides.marqueeImageId
        }
      />
    </div>,
  );
  return container;
};

const layerNode = (container: HTMLElement): HTMLElement => {
  const node = container.querySelector<HTMLElement>(
    '[data-testid="marquee-selection-layer"]',
  );
  if (!node) throw new Error('marquee layer not mounted');
  return node;
};

const multiSelection = (): Record<string, string[]> =>
  useTypographerStore.getState().typographerMultiSelectedByImage;

beforeEach(() => {
  Element.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
    return {
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      right: 100,
      bottom: 100,
      toJSON: () => ({}),
    } as DOMRect;
  };
  installPointerCaptureStub();
  useTypographerStore.setState({ typographerMultiSelectedByImage: {} });
});

afterEach(() => {
  cleanup();
  Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
});

describe('MarqueeSelectionLayer', () => {
  it('renders nothing while the marquee tool is not active', () => {
    const container = renderLayer({ tool: 'select' });
    expect(container.querySelector('[data-testid="marquee-selection-layer"]')).toBeNull();
  });

  it('renders nothing when area selection is disabled', () => {
    const container = renderLayer({ areaSelectionEnabled: false });
    expect(container.querySelector('[data-testid="marquee-selection-layer"]')).toBeNull();
  });

  it('renders nothing without an owning image id', () => {
    const container = renderLayer({ marqueeImageId: null });
    expect(container.querySelector('[data-testid="marquee-selection-layer"]')).toBeNull();
  });

  it('renders nothing outside the typesetter stage even with the marquee tool leaked', () => {
    // The typographer tool is global and persists across stage switches; a
    // ghost layer in another stage would swallow every pointer interaction.
    const container = renderLayer({ mode: 'aio' });
    expect(container.querySelector('[data-testid="marquee-selection-layer"]')).toBeNull();
  });

  it('intercepts pointer events (stopPropagation) and writes intersecting regions in array order', () => {
    const wrapperPointerDown = vi.fn();
    const container = renderLayer({
      wrapperHandlers: { onPointerDown: wrapperPointerDown },
    });

    pointer(layerNode(container), 'pointerdown', { clientX: 10, clientY: 10 });
    pointer(layerNode(container), 'pointermove', { clientX: 80, clientY: 80 });
    pointer(layerNode(container), 'pointerup', { clientX: 80, clientY: 80 });

    expect(wrapperPointerDown).not.toHaveBeenCalled();
    expect(multiSelection()).toEqual({ 'img-1': ['r-a', 'r-b', 'r-c'] });
  });

  it('writes only the regions inside the dragged rectangle', () => {
    const container = renderLayer();
    pointer(layerNode(container), 'pointerdown', { clientX: 70, clientY: 10 });
    pointer(layerNode(container), 'pointerup', { clientX: 90, clientY: 40 });
    expect(multiSelection()).toEqual({ 'img-1': ['r-b'] });
  });

  it('clears the per-image selection when the marquee intersects nothing', () => {
    useTypographerStore.setState({
      typographerMultiSelectedByImage: { 'img-1': ['r-a'], 'img-2': ['r-b'] },
    });
    const container = renderLayer();
    pointer(layerNode(container), 'pointerdown', { clientX: 99, clientY: 99 });
    pointer(layerNode(container), 'pointerup', { clientX: 100, clientY: 100 });
    expect(multiSelection()).toEqual({ 'img-2': ['r-b'] });
  });

  it('clears the per-image selection on a plain click without drag (degenerate rect)', () => {
    const container = renderLayer();
    pointer(layerNode(container), 'pointerdown', { clientX: 25, clientY: 25 });
    pointer(layerNode(container), 'pointerup', { clientX: 25, clientY: 25 });
    expect(multiSelection()).toEqual({});
  });

  it('discards the gesture on pointercancel without writing the store', () => {
    useTypographerStore.setState({
      typographerMultiSelectedByImage: { 'img-1': ['r-a'] },
    });
    const container = renderLayer();
    pointer(layerNode(container), 'pointerdown', { clientX: 10, clientY: 10 });
    pointer(layerNode(container), 'pointercancel');
    expect(multiSelection()).toEqual({ 'img-1': ['r-a'] });
    expect(layerNode(container).querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it('draws the live rectangle while dragging and writes only on pointerup', () => {
    const container = renderLayer();
    pointer(layerNode(container), 'pointerdown', { clientX: 10, clientY: 10 });
    pointer(layerNode(container), 'pointermove', { clientX: 80, clientY: 80 });
    expect(multiSelection()).toEqual({});
    expect(layerNode(container).querySelector('[aria-hidden="true"]')).not.toBeNull();
    pointer(layerNode(container), 'pointerup', { clientX: 80, clientY: 80 });
    expect(multiSelection()).toEqual({ 'img-1': ['r-a', 'r-b', 'r-c'] });
    expect(layerNode(container).querySelector('[aria-hidden="true"]')).toBeNull();
  });
});
