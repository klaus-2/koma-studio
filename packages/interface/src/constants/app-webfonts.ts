export const KOMA_FONT_STYLESHEET_URL =
  "https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&family=Cabin:wght@500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;700&family=Manrope:wght@400;500;600;700&display=swap";

// A base keeps a relative or empty input parsing to an empty query instead of throwing.
const GOOGLE_FONTS_URL_BASE = "https://fonts.googleapis.com/css2";

export const parseGoogleFontFamilies = (url: string): string[] => {
  const families: string[] = [];
  const seenFamilies = new Set<string>();

  // The platform query parser decodes `%20` as well as `+`.
  for (const parameter of new URL(url, GOOGLE_FONTS_URL_BASE).searchParams.getAll("family")) {
    const axisSeparatorIndex = parameter.indexOf(":");
    const family = (
      axisSeparatorIndex >= 0 ? parameter.slice(0, axisSeparatorIndex) : parameter
    ).trim();
    if (!family) {
      continue;
    }

    const dedupeKey = family.toLowerCase();
    if (seenFamilies.has(dedupeKey)) {
      continue;
    }
    seenFamilies.add(dedupeKey);
    families.push(family);
  }

  return families;
};

export const APP_WEBFONT_FAMILIES: readonly string[] = parseGoogleFontFamilies(
  KOMA_FONT_STYLESHEET_URL,
);
