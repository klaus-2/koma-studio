import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  DEFAULT_APP_LOCALE,
  LOCALE_LABELS,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  dedupeLocales,
  isRtlLocale,
  normalizeLocale,
  resolveLocaleChain,
  toHtmlLang,
  type AppLocale,
} from "./config";
import {
  defaultTranslationCatalogs,
  loadTranslationCatalog,
  translateMessage,
  type TranslationCatalog,
  type TranslationKey,
} from "./messages";

import { desktopBridge } from "@/lib/desktop-bridge";
interface DesktopLocalePreferences {
  appLocale?: string;
  systemLocales?: string[];
}

type TranslationVars = Record<string, string | number | null | undefined>;

interface I18nContextValue {
  locale: AppLocale;
  localeTag: string;
  dir: "ltr" | "rtl";
  systemLocales: AppLocale[];
  supportedLocales: readonly AppLocale[];
  localeLabels: Record<AppLocale, string>;
  t: (key: TranslationKey, vars?: TranslationVars) => string;
  setLocale: (locale: AppLocale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const readStoredLocale = (): AppLocale | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return null;
  }
};

const readBrowserLocales = (): AppLocale[] => {
  if (typeof window === "undefined") {
    return [DEFAULT_APP_LOCALE];
  }

  return dedupeLocales([...(window.navigator.languages ?? []), window.navigator.language]);
};

const readDesktopLocalePreferences = async (): Promise<DesktopLocalePreferences | null> => {
  if (typeof window === "undefined" || !desktopBridge.desktop?.locale?.getPreferences) {
    return null;
  }

  try {
    return (await desktopBridge.desktop.locale.getPreferences()) as DesktopLocalePreferences;
  } catch {
    return null;
  }
};

const detectInitialLocale = (): AppLocale => readStoredLocale() ?? readBrowserLocales()[0] ?? DEFAULT_APP_LOCALE;

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocaleState] = useState<AppLocale>(detectInitialLocale);
  const [systemLocales, setSystemLocales] = useState<AppLocale[]>(readBrowserLocales);
  const [catalogs, setCatalogs] =
    useState<Partial<Record<AppLocale, TranslationCatalog>>>(defaultTranslationCatalogs);

  useEffect(() => {
    let active = true;

    const syncLocalePreferences = async () => {
      const desktopPreferences = await readDesktopLocalePreferences();
      if (!active || !desktopPreferences) {
        return;
      }

      const detectedSystemLocales = dedupeLocales([
        ...(desktopPreferences.systemLocales ?? []),
        desktopPreferences.appLocale,
      ]);

      if (detectedSystemLocales.length > 0) {
        setSystemLocales(detectedSystemLocales);
      }

      if (!readStoredLocale() && detectedSystemLocales[0]) {
        setLocaleState(detectedSystemLocales[0]);
      }
    };

    void syncLocalePreferences();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const missingLocales = resolveLocaleChain(locale).filter(
      (entry) => entry !== DEFAULT_APP_LOCALE && !catalogs[entry],
    );

    if (missingLocales.length === 0) {
      return () => {
        active = false;
      };
    }

    void Promise.all(
      missingLocales.map(async (entry) => {
        const catalog = await loadTranslationCatalog(entry);
        return [entry, catalog] as const;
      }),
    )
      .then((loadedCatalogs) => {
        if (!active) {
          return;
        }

        setCatalogs((current) => {
          const next = { ...current };
          loadedCatalogs.forEach(([entry, catalog]) => {
            next[entry] = catalog;
          });
          return next;
        });
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [catalogs, locale]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // no-op
    }
  }, [locale]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.documentElement.lang = toHtmlLang(locale);
    document.documentElement.dir = isRtlLocale(locale) ? "rtl" : "ltr";
  }, [locale]);

  const setLocale = useCallback((nextLocale: AppLocale) => {
    setLocaleState(nextLocale);
  }, []);

  const t = useCallback(
    (key: TranslationKey, vars?: TranslationVars) => translateMessage(locale, key, vars, catalogs),
    [catalogs, locale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      localeTag: toHtmlLang(locale),
      dir: isRtlLocale(locale) ? "rtl" : "ltr",
      systemLocales,
      supportedLocales: SUPPORTED_LOCALES,
      localeLabels: LOCALE_LABELS,
      t,
      setLocale,
    }),
    [locale, setLocale, systemLocales, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nContextValue => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider.");
  }
  return context;
};
