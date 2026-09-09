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

export const DEFAULT_APP_LOCALE: AppLocale = "en";
export const RTL_LOCALES = new Set<AppLocale>(["ar"]);
export const LOCALE_STORAGE_KEY = "koma-studio.locale.v1";

export const LOCALE_LABELS: Record<AppLocale, string> = {
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
};

const NORMALIZED_LOCALE_MAP = new Map<string, AppLocale>([
  ["ar", "ar"],
  ["ar-sa", "ar"],
  ["de", "de"],
  ["de-de", "de"],
  ["en", "en"],
  ["en-us", "en"],
  ["en-gb", "en"],
  ["es", "es"],
  ["es-es", "es"],
  ["es-419", "es"],
  ["fr", "fr"],
  ["fr-fr", "fr"],
  ["hi", "hi"],
  ["hi-in", "hi"],
  ["it", "it"],
  ["it-it", "it"],
  ["ja", "ja"],
  ["ja-jp", "ja"],
  ["ko", "ko"],
  ["ko-kr", "ko"],
  ["pt", "pt"],
  ["pt-pt", "pt"],
  ["pt_br", "pt-br"],
  ["pt-br", "pt-br"],
  ["ru", "ru"],
  ["ru-ru", "ru"],
  ["zh", "zh"],
  ["zh-cn", "zh"],
  ["zh-hans", "zh"],
  ["zh-sg", "zh"],
  ["zh-tw", "zh-tw"],
  ["zh-hant", "zh-tw"],
  ["zh-hk", "zh-tw"],
  ["zh-mo", "zh-tw"],
]);

export const normalizeLocale = (value: string | null | undefined): AppLocale | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase().replace(/_/g, "-");
  if (!normalized) {
    return null;
  }

  const direct = NORMALIZED_LOCALE_MAP.get(normalized);
  if (direct) {
    return direct;
  }

  if (normalized.startsWith("pt-br")) {
    return "pt-br";
  }

  const root = normalized.split("-")[0] ?? '';
  return (SUPPORTED_LOCALES as readonly string[]).includes(root) ? (root as AppLocale) : null;
};

export const dedupeLocales = (values: Array<string | null | undefined>): AppLocale[] => {
  const seen = new Set<AppLocale>();
  const result: AppLocale[] = [];

  values.forEach((value) => {
    const locale = normalizeLocale(value);
    if (!locale || seen.has(locale)) {
      return;
    }

    seen.add(locale);
    result.push(locale);
  });

  return result;
};

export const resolveLocaleChain = (locale: AppLocale): AppLocale[] =>
  dedupeLocales([
    locale,
    locale === "pt-br" ? "pt" : null,
    locale === "pt" ? "pt-br" : null,
    locale === "zh-tw" ? "zh" : null,
    locale === "zh" ? "zh-tw" : null,
    "en",
    DEFAULT_APP_LOCALE,
  ]);

export const toHtmlLang = (locale: AppLocale): string => {
  if (locale === "pt-br") return "pt-BR";
  if (locale === "zh-tw") return "zh-TW";
  return locale;
};

export const isRtlLocale = (locale: AppLocale): boolean => RTL_LOCALES.has(locale);
