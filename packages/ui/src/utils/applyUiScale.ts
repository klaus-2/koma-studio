import { useEffect } from 'react';

import { useUiScaleStore, type UiScale } from '../stores/ui-scale-store';

export const COMPACT_DENSITY_CLASS = 'koma-density-compact';

export type NativeUiZoomHandler = (scale: UiScale) => Promise<boolean> | boolean;

let nativeZoomHandler: NativeUiZoomHandler | null = null;
let nativeZoomActive = false;
let applySequence = 0;

export function setUiScaleNativeZoomHandler(handler: NativeUiZoomHandler | null): void {
  nativeZoomHandler = handler;
  if (!handler) {
    nativeZoomActive = false;
  }
}

export function isNativeUiZoomActive(): boolean {
  return nativeZoomActive;
}

export function getEffectiveCssRootZoom(): number {
  if (nativeZoomActive) {
    return 1;
  }
  const scale = useUiScaleStore.getState().uiScale;
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

export function toCssViewportCoord(viewportPx: number): number {
  return viewportPx / getEffectiveCssRootZoom();
}

const applyCssFallbackZoom = (uiScale: UiScale): void => {
  nativeZoomActive = false;
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.style.setProperty('zoom', String(uiScale));
};

export function applyUiScale(uiScale: UiScale, compactDensity: boolean): void {
  if (typeof document === 'undefined') {
    return;
  }
  const root = document.documentElement;
  root.classList.toggle(COMPACT_DENSITY_CLASS, compactDensity);
  root.dataset.uiScale = String(uiScale);

  const sequence = (applySequence += 1);
  if (!nativeZoomHandler) {
    applyCssFallbackZoom(uiScale);
    return;
  }

  let outcome: Promise<boolean> | boolean;
  try {
    outcome = nativeZoomHandler(uiScale);
  } catch {
    applyCssFallbackZoom(uiScale);
    return;
  }

  if (typeof outcome === 'boolean') {
    if (outcome) {
      nativeZoomActive = true;
      root.style.removeProperty('zoom');
    } else {
      applyCssFallbackZoom(uiScale);
    }
    return;
  }

  void outcome.then(
    (handled) => {
      if (sequence !== applySequence) {
        return;
      }
      if (handled) {
        nativeZoomActive = true;
        root.style.removeProperty('zoom');
      } else {
        applyCssFallbackZoom(uiScale);
      }
    },
    () => {
      if (sequence !== applySequence) {
        return;
      }
      applyCssFallbackZoom(uiScale);
    },
  );
}

export function useUiScaleEffect(): void {
  const uiScale = useUiScaleStore((s) => s.uiScale);
  const compactDensity = useUiScaleStore((s) => s.compactDensity);
  useEffect(() => {
    applyUiScale(uiScale, compactDensity);
  }, [uiScale, compactDensity]);
}
