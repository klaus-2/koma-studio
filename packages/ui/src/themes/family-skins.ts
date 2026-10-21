/* ============================================================
   KŌMA STUDIO — Theme family skin picker
   One typed seam for classic/noir React skins. Callers never
   branch on `family === 'noir'` themselves.
   ============================================================ */

import { createElement, type FunctionComponent } from 'react';

import { useThemeStore, type KomaThemeFamily } from '../stores/theme-store';

export type FamilySkins<T> = Readonly<Record<KomaThemeFamily, T>>;

/** Resolve the skin for a family. The seam: one adapter per family. */
export function pickFamilySkin<T>(
  family: KomaThemeFamily,
  skins: FamilySkins<T>,
): T {
  return skins[family];
}

/** Subscribe to the active family and resolve its skin. */
export function useFamilySkin<T>(skins: FamilySkins<T>): T {
  const family = useThemeStore((s) => s.family);
  return skins[family];
}

/** Event-time family read for non-React call sites (render helpers). */
export function currentFamilySkin<T>(skins: FamilySkins<T>): T {
  return skins[useThemeStore.getState().family];
}

export function createFamilyComponent<P extends object>(
  classic: FunctionComponent<P>,
  noir: FunctionComponent<P>,
): FunctionComponent<P> {
  return function FamilyComponent(props: P) {
    const family = useThemeStore((s) => s.family);
    return family === 'noir'
      ? createElement<P>(noir, props)
      : createElement<P>(classic, props);
  };
}
