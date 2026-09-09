// i18n port for shared packages (@koma/ui, @koma/auth).
// The app registers its hook at bootstrap: setUiI18n(useI18n).
// Guard: useUiI18n() throws if not registered — fail early, not silently.

export interface UiI18nResult {
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: string;
}

type UiI18nHook = () => UiI18nResult;

let hook: UiI18nHook | null = null;

export const setUiI18n = (next: UiI18nHook): void => {
  hook = next;
};

export const useUiI18n = (): UiI18nResult => {
  if (!hook) {
    throw new Error("@koma/ui: setUiI18n(useI18n) was not called during app bootstrap");
  }
  return hook();
};
