export const SUPPORTED_LOCALES = [
  "ar",
  "de",
  "en",
  "es",
  "fr",
  "hi",
  "it",
  "ja",
  "ko",
  "pt",
  "pt-br",
  "ru",
  "zh",
  "zh-tw",
] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_APP_LOCALE = "en" satisfies AppLocale;
export const LOCALE_STORAGE_KEY = "koma-studio.locale.v1";

export const RTL_LOCALES: ReadonlySet<AppLocale> = new Set<AppLocale>([
  "ar",
]);

export const LOCALE_LABELS: Readonly<Record<AppLocale, string>> = Object.freeze({
  ar: "العربية",
  de: "Deutsch",
  en: "English",
  es: "Español",
  fr: "Français",
  hi: "हिन्दी",
  it: "Italiano",
  ja: "日本語",
  ko: "한국어",
  pt: "Português",
  "pt-br": "Português (Brasil)",
  ru: "Русский",
  zh: "中文",
  "zh-tw": "繁體中文",
});

const supportedLocaleSet: ReadonlySet<string> = new Set(SUPPORTED_LOCALES);

const traditionalChineseRegions: ReadonlySet<string> = new Set([
  "TW",
  "HK",
  "MO",
]);

const isAppLocale = (value: string): value is AppLocale =>
  supportedLocaleSet.has(value);

export const normalizeLocale = (
  value: string | null | undefined,
): AppLocale | null => {
  const normalized = value?.trim().replace(/_/g, "-").toLowerCase();

  if (!normalized) {
    return null;
  }

  if (isAppLocale(normalized)) {
    return normalized;
  }

  let locale: Intl.Locale;

  try {
    locale = new Intl.Locale(normalized);
  } catch {
    return null;
  }

  const language = locale.language.toLowerCase();

  if (language === "pt") {
    return locale.region === "BR" ? "pt-br" : "pt";
  }

  if (language === "zh") {
    if (locale.script === "Hant") {
      return "zh-tw";
    }

    if (locale.script === "Hans") {
      return "zh";
    }

    return locale.region && traditionalChineseRegions.has(locale.region)
      ? "zh-tw"
      : "zh";
  }

  return isAppLocale(language) ? language : null;
};

export const dedupeLocales = (
  values: ReadonlyArray<string | null | undefined>,
): AppLocale[] => {
  const seen = new Set<AppLocale>();
  const result: AppLocale[] = [];

  for (const value of values) {
    const locale = normalizeLocale(value);

    if (locale !== null && !seen.has(locale)) {
      seen.add(locale);
      result.push(locale);
    }
  }

  return result;
};

const localeFallbacks = {
  ar: ["ar", "en"],
  de: ["de", "en"],
  en: ["en"],
  es: ["es", "en"],
  fr: ["fr", "en"],
  hi: ["hi", "en"],
  it: ["it", "en"],
  ja: ["ja", "en"],
  ko: ["ko", "en"],
  pt: ["pt", "pt-br", "en"],
  "pt-br": ["pt-br", "pt", "en"],
  ru: ["ru", "en"],
  zh: ["zh", "zh-tw", "en"],
  "zh-tw": ["zh-tw", "zh", "en"],
} as const satisfies Readonly<Record<AppLocale, readonly AppLocale[]>>;

export const resolveLocaleChain = (locale: AppLocale): AppLocale[] => [
  ...localeFallbacks[locale],
];

export const toHtmlLang = (locale: AppLocale): string => {
  switch (locale) {
    case "pt-br":
      return "pt-BR";
    case "zh-tw":
      return "zh-TW";
    default:
      return locale;
  }
};

export const isRtlLocale = (locale: AppLocale): boolean =>
  RTL_LOCALES.has(locale);
