import {
  DEFAULT_APP_LOCALE,
  getLocaleFallbackChain,
} from "@/i18n/config";
import type { AppLocale } from "@/i18n/config";
import { fallbackDefaultMessages } from "@/i18n/fallbackKeys";
import { enMessages } from "@/i18n/langs/en";

export type TranslationKey =
  | keyof typeof enMessages
  | keyof typeof fallbackDefaultMessages;

export type TranslationCatalog = Readonly<
  Partial<Record<TranslationKey, string>>
>;

export type TranslationVars = Readonly<
  Record<string, string | number | null | undefined>
>;

export type TranslationCatalogMap = Readonly<
  Partial<Record<AppLocale, TranslationCatalog>>
>;

export const defaultMessages = Object.freeze({
  ...fallbackDefaultMessages,
  ...enMessages,
});

type LazyLocale = Exclude<AppLocale, typeof DEFAULT_APP_LOCALE>;
type CatalogLoader = () => Promise<unknown>;

const isTranslationCatalog = (value: unknown): value is TranslationCatalog => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((entry) => typeof entry === "string");
};

const lazyCatalogLoaders = {
  ar: () => import("@/i18n/langs/ar").then((module) => module.arMessages),
  de: () => import("@/i18n/langs/de").then((module) => module.deMessages),
  es: () => import("@/i18n/langs/es").then((module) => module.esMessages),
  fr: () => import("@/i18n/langs/fr").then((module) => module.frMessages),
  hi: () => import("@/i18n/langs/hi").then((module) => module.hiMessages),
  it: () => import("@/i18n/langs/it").then((module) => module.itMessages),
  ja: () => import("@/i18n/langs/ja").then((module) => module.jaMessages),
  ko: () => import("@/i18n/langs/ko").then((module) => module.koMessages),
  pt: () => import("@/i18n/langs/pt").then((module) => module.ptMessages),
  "pt-br": () =>
    import("@/i18n/langs/ptBR").then((module) => module.ptBrMessages),
  ru: () => import("@/i18n/langs/ru").then((module) => module.ruMessages),
  zh: () => import("@/i18n/langs/zh").then((module) => module.zhMessages),
  "zh-tw": () =>
    import("@/i18n/langs/zhTW").then((module) => module.zhMessages),
} satisfies Record<LazyLocale, CatalogLoader>;

const pendingCatalogs = new Map<
  LazyLocale,
  Promise<TranslationCatalog>
>();

export class TranslationCatalogLoadError extends Error {
  public readonly locale: AppLocale;

  public constructor(locale: AppLocale) {
    super(`Unable to load the translation catalog for locale "${locale}".`);
    this.name = "TranslationCatalogLoadError";
    this.locale = locale;
  }
}

const readOwnString = (
  source: object | undefined,
  key: string,
): string | undefined => {
  if (source === undefined) {
    return undefined;
  }

  const descriptor = Object.getOwnPropertyDescriptor(source, key);
  const value: unknown = descriptor?.value;

  return typeof value === "string" ? value : undefined;
};

const interpolate = (
  template: string,
  vars?: TranslationVars,
): string => {
  if (vars === undefined) {
    return template;
  }

  return template.replace(
    /\{([a-zA-Z0-9_]+)\}/g,
    (_match: string, key: string): string => {
      const descriptor = Object.getOwnPropertyDescriptor(vars, key);
      const value: unknown = descriptor?.value;

      return typeof value === "string" || typeof value === "number"
        ? String(value)
        : "";
    },
  );
};

const findMessage = (
  locale: AppLocale,
  key: string,
  catalogs: TranslationCatalogMap,
): string | undefined => {
  for (const candidate of getLocaleFallbackChain(locale)) {
    const catalog =
      candidate === DEFAULT_APP_LOCALE
        ? defaultMessages
        : catalogs[candidate];

    const message = readOwnString(catalog, key);

    if (message !== undefined) {
      return message;
    }
  }

  return undefined;
};

export const translateMessage = (
  locale: AppLocale,
  key: TranslationKey,
  vars?: TranslationVars,
  catalogs: TranslationCatalogMap = defaultTranslationCatalogs,
): string => {
  const template = findMessage(locale, key, catalogs);

  return template === undefined ? key : interpolate(template, vars);
};

export const translateDynamicMessage = (
  locale: AppLocale,
  key: string,
  vars?: TranslationVars,
  catalogs: TranslationCatalogMap = defaultTranslationCatalogs,
): string => {
  const template = findMessage(locale, key, catalogs);

  return template === undefined ? key : interpolate(template, vars);
};

/**
 * Resolves a key that may be absent from the catalogs (tooltip copy ships an
 * English fallback from the owning component): returns the translation, or
 * `fallback` when the key itself came back untranslated.
 */
export const translateOrFallback = (
  locale: AppLocale,
  key: string,
  fallback: string,
): string => {
  const value = translateDynamicMessage(locale, key);
  return value === key ? fallback : value;
};

export const loadTranslationCatalog = (
  locale: AppLocale,
): Promise<TranslationCatalog> => {
  if (locale === DEFAULT_APP_LOCALE) {
    return Promise.resolve(defaultMessages);
  }

  const existing = pendingCatalogs.get(locale);

  if (existing !== undefined) {
    return existing;
  }

  const pending = Promise.resolve()
    .then(() => lazyCatalogLoaders[locale]())
    .then((payload): TranslationCatalog => {
      if (!isTranslationCatalog(payload)) {
        throw new TranslationCatalogLoadError(locale);
      }

      return Object.freeze(payload);
    })
    .catch((): never => {
      pendingCatalogs.delete(locale);
      throw new TranslationCatalogLoadError(locale);
    });

  pendingCatalogs.set(locale, pending);
  return pending;
};

export const defaultTranslationCatalogs: TranslationCatalogMap =
  Object.freeze({
    [DEFAULT_APP_LOCALE]: defaultMessages,
  });
