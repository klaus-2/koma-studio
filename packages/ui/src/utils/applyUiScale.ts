/* ============================================================
   KŌMA STUDIO — UI Scale application
   Mirror of applyTheme: applies style.zoom + the compact-density
   class to the document root, live (no restart).
   ============================================================ */

import { useEffect } from 'react';

import { useUiScaleStore, type UiScale } from '../stores/ui-scale-store';

export const COMPACT_DENSITY_CLASS = 'koma-density-compact';

/**
 * Apply the current UI scale (root zoom) and density to the document root.
 * Must be called once on mount and whenever uiScale/compactDensity changes.
 */
export function applyUiScale(uiScale: UiScale, compactDensity: boolean): void {
  const root = document.documentElement;
  root.style.setProperty('zoom', String(uiScale));
  root.classList.toggle(COMPACT_DENSITY_CLASS, compactDensity);
}

/**
 * Mount hook: applies the store state on boot and re-applies it on every
 * uiScale/compactDensity change, so the scale switch is live.
 */
export function useUiScaleEffect(): void {
  const uiScale = useUiScaleStore((s) => s.uiScale);
  const compactDensity = useUiScaleStore((s) => s.compactDensity);
  useEffect(() => {
    applyUiScale(uiScale, compactDensity);
  }, [uiScale, compactDensity]);
}
