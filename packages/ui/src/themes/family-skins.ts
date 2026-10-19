import { useThemeStore, type KomaThemeFamily } from '../stores/theme-store';

export type FamilySkins<T> = Readonly<Record<KomaThemeFamily, T>>;

export function pickFamilySkin<T>(
  family: KomaThemeFamily,
  skins: FamilySkins<T>,
): T {
  return skins[family];
}

export function useFamilySkin<T>(skins: FamilySkins<T>): T {
  const family = useThemeStore((s) => s.family);
  return skins[family];
}

export function currentFamilySkin<T>(skins: FamilySkins<T>): T {
  return skins[useThemeStore.getState().family];
}
