import type { AppLocale } from "./config";
import { DEFAULT_APP_LOCALE, resolveLocaleChain } from "./config";
import { enMessages as enBase } from "./langs/en";
import { fallbackDefaultMessages } from "./fallbackKeys";

export type TranslationKey = keyof typeof enBase | (string & Record<never, never>);
export type TranslationCatalog = Partial<Record<TranslationKey, string>>;
type TranslationVars = Record<string, string | number | null | undefined>;

// Fallback keys are merged into the default catalog so any locale
// that doesn't override them still returns a value instead of the
// raw key.
export const defaultMessages: typeof enBase = {
  ...fallbackDefaultMessages,
  ...enBase,
};

type LazyLocale = Exclude<AppLocale, typeof DEFAULT_APP_LOCALE>;
type TranslationCatalogMap = Partial<Record<AppLocale, TranslationCatalog>>;

const lazyCatalogLoaders: Record<LazyLocale, () => Promise<TranslationCatalog>> = {
  ar: () => import("./langs/ar").then((module) => module.arMessages),
  de: () => import("./langs/de").then((module) => module.deMessages),
  es: () => import("./langs/es").then((module) => module.esMessages),
  fr: () => import("./langs/fr").then((module) => module.frMessages),
  hi: () => import("./langs/hi").then((module) => module.hiMessages),
  it: () => import("./langs/it").then((module) => module.itMessages),
  ja: () => import("./langs/ja").then((module) => module.jaMessages),
  ko: () => import("./langs/ko").then((module) => module.koMessages),
  pt: () => import("./langs/pt").then((module) => module.ptMessages),
  "pt-br": () => import("./langs/ptBR").then((module) => module.ptBrMessages),
  ru: () => import("./langs/ru").then((module) => module.ruMessages),
  zh: () => import("./langs/zh").then((module) => module.zhMessages),
  "zh-tw": () => import("./langs/zhTW").then((module) => module.zhMessages),
};

const interpolate = (template: string, vars?: TranslationVars): string => {
  if (!vars) {
    return template;
  }

  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) => {
    const value = vars[key];
    return value === null || value === undefined ? "" : String(value);
  });
};

export const translateMessage = (
  locale: AppLocale,
  key: TranslationKey,
  vars?: TranslationVars,
  catalogs: TranslationCatalogMap = {},
): string => {
  for (const entry of resolveLocaleChain(locale)) {
    const catalog = entry === DEFAULT_APP_LOCALE ? defaultMessages : catalogs[entry];
    const template = (catalog as Record<string, string | undefined> | undefined)?.[key];
    if (template) {
      return interpolate(template, vars);
    }
  }

  const fallback = (defaultMessages as Record<string, string | undefined>)[key];
  return fallback ? interpolate(fallback, vars) : key;
};

export const loadTranslationCatalog = async (
  locale: AppLocale,
): Promise<TranslationCatalog> => {
  if (locale === DEFAULT_APP_LOCALE) {
    return defaultMessages;
  }

  const loader = (lazyCatalogLoaders as Record<string, (() => Promise<TranslationCatalog>) | undefined>)[locale];
  if (!loader) return defaultMessages;
  return loader();
};

export const defaultTranslationCatalogs: TranslationCatalogMap = {
  [DEFAULT_APP_LOCALE]: defaultMessages,
};
