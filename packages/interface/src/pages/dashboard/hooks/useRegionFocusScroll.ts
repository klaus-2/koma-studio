import { useCallback, useRef } from 'react';
import { create } from 'zustand';

import type { LoadedImage } from '../../../types/dashboard.types';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useUiShellStore } from '../stores/ui-shell-store';

export interface FocusIndexSignal {
  readonly index: number;
  readonly nonce: number;
}

export interface RegionFocusScrollArgs {
  readonly imageId: string;
  readonly regionId: string;
}

export interface RegionFocusScrollApi {
  readonly focusRegion: (args: RegionFocusScrollArgs) => Promise<void>;
}

export interface ComputeZoomCorrectedScrollTopArgs {
  readonly container: HTMLElement;
  readonly regionRect: DOMRect;
  readonly containerRect: DOMRect;
  readonly zoom: number;
}

export const computeZoomCorrectedScrollTop = (
  args: ComputeZoomCorrectedScrollTopArgs,
): number => {
  const { container, regionRect, containerRect, zoom } = args;
  const safeZoom = zoom > 0 && Number.isFinite(zoom) ? zoom : 1;
  const visualDelta =
    regionRect.top -
    containerRect.top -
    (containerRect.height - regionRect.height) / 2;
  return container.scrollTop + visualDelta / safeZoom;
};

export const resolveFocusSignal = (
  images: ReadonlyArray<Pick<LoadedImage, 'id'>>,
  imageId: string,
  nonce: number,
): FocusIndexSignal | null => {
  const index = images.findIndex((image) => image.id === imageId);
  return index >= 0 ? { index, nonce } : null;
};

interface RegionFocusStoreState {
  readonly focusIndexSignal: FocusIndexSignal | null;
  readonly emitFocusIndexSignal: (index: number, nonce: number) => void;
}

const useRegionFocusStore = create<RegionFocusStoreState>()((set) => ({
  focusIndexSignal: null,
  emitFocusIndexSignal: (index, nonce) =>
    set({ focusIndexSignal: { index, nonce } }),
}));

export const useRegionFocusSignal = (): FocusIndexSignal | null =>
  useRegionFocusStore((s) => s.focusIndexSignal);

const waitFrames = (frames: number): Promise<void> => {
  let remaining = frames;
  return new Promise((resolve) => {
    const tick = (): void => {
      remaining -= 1;
      if (remaining <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
};

const findRegionOverlay = (
  index: number | null,
  regionId: string,
): HTMLElement | null => {
  if (index !== null) {
    const item = document.querySelector(
      `[data-long-strip-index="${index}"]`,
    );
    const scoped = item?.querySelector(`[data-region-id="${regionId}"]`);
    if (scoped instanceof HTMLElement) return scoped;
  }
  return document.querySelector(`[data-region-id="${regionId}"]`);
};

const findScrollContainer = (element: HTMLElement): HTMLElement | null => {
  let node: HTMLElement | null = element.parentElement;
  while (node) {
    const style = getComputedStyle(node);
    const scrolls = /(auto|scroll)/.test(style.overflowY);
    if (scrolls && node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return null;
};

export const useRegionFocusScroll = (): RegionFocusScrollApi => {
  const nonceRef = useRef(0);

  const focusRegion = useCallback(
    async ({ imageId, regionId }: RegionFocusScrollArgs): Promise<void> => {
      const images = useImageCollectionStore.getState().images;
      const nonce = nonceRef.current + 1;
      const signal = resolveFocusSignal(images, imageId, nonce);
      if (!signal) return;
      nonceRef.current = nonce;
      useRegionFocusStore.getState().emitFocusIndexSignal(
        signal.index,
        signal.nonce,
      );

      await waitFrames(2);
      let overlay = findRegionOverlay(signal.index, regionId);
      if (!overlay) {
        await waitFrames(1);
        overlay = findRegionOverlay(signal.index, regionId);
      }
      if (!overlay) return;

      const container = findScrollContainer(overlay);
      if (!container) return;
      const zoom = useUiShellStore.getState().zoom;
      container.scrollTop = computeZoomCorrectedScrollTop({
        container,
        regionRect: overlay.getBoundingClientRect(),
        containerRect: container.getBoundingClientRect(),
        zoom,
      });
    },
    [],
  );

  return { focusRegion };
};
