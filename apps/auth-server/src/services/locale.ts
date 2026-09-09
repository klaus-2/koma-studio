export const SUPPORTED_EMAIL_LOCALES = [
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
] as const;

export type EmailLocale = (typeof SUPPORTED_EMAIL_LOCALES)[number];

export const DEFAULT_EMAIL_LOCALE: EmailLocale = "en";

const NORMALIZED_LOCALE_MAP = new Map<string, EmailLocale>([
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
  ["zh-tw", "zh"],
  ["zh-hant", "zh"],
]);

export const normalizeEmailLocale = (
  value: string | null | undefined,
): EmailLocale | null => {
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

  const root = normalized.split("-")[0] ?? "";
  return (SUPPORTED_EMAIL_LOCALES as readonly string[]).includes(root)
    ? (root as EmailLocale)
    : null;
};

export const detectLocaleFromAcceptLanguage = (
  headerValue: string | null | undefined,
): EmailLocale | null => {
  if (!headerValue) {
    return null;
  }

  const candidates = headerValue
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [tagPart, ...params] = entry.split(";").map((part) => part.trim());
      const qParam = params.find((param) => param.startsWith("q="));
      const qValue = qParam ? Number(qParam.slice(2)) : 1;
      return {
        tag: tagPart ?? "",
        quality: Number.isFinite(qValue) ? qValue : 1,
      };
    })
    .filter((entry) => entry.tag.length > 0)
    .sort((left, right) => right.quality - left.quality);

  for (const candidate of candidates) {
    const locale = normalizeEmailLocale(candidate.tag);
    if (locale) {
      return locale;
    }
  }

  return null;
};

export const resolvePreferredEmailLocale = ({
  explicitLocale,
  userLocale,
  acceptLanguage,
}: {
  explicitLocale?: string | null;
  userLocale?: string | null;
  acceptLanguage?: string | null;
}): EmailLocale =>
  normalizeEmailLocale(explicitLocale) ??
  normalizeEmailLocale(userLocale) ??
  detectLocaleFromAcceptLanguage(acceptLanguage) ??
  DEFAULT_EMAIL_LOCALE;

export const toIntlLocale = (locale: EmailLocale): string =>
  locale === "pt-br" ? "pt-BR" : locale;
