import {
  segmentText,
  splitGraphemes,
} from "@/utils/renderText.unicode";

export interface TextMeasurer {
  measureText(text: string): Readonly<{ width: number }>;
}

export interface HyphenationProfile {
  readonly vowels: ReadonlySet<string>;
  readonly weakVowels: ReadonlySet<string>;
  readonly accentedWeakVowels: ReadonlySet<string>;
}

export interface TokenAffixes {
  readonly prefix: string;
  readonly word: string;
  readonly suffix: string;
}

export interface WordSplit {
  readonly head: string;
  readonly tail: string;
}

export const LATIN_WORD_PATTERN = /^(?:\p{Script=Latin}\p{M}*)+$/u;

export const LATIN_WORD_TOKEN_PATTERN =
  /^([^\p{L}\p{N}\p{M}]*)([\p{Script=Latin}][\p{Script=Latin}\p{M}]*)([^\p{L}\p{N}\p{M}]*)$/u;

export const LATIN_ALLOWED_ONSET_CLUSTERS: ReadonlySet<string> = new Set([
  "bl", "br", "ch", "cl", "cr", "dr", "fl", "fr", "gl", "gr",
  "gu", "lh", "nh", "pl", "pr", "qu", "sc", "sh", "sk", "sl",
  "sm", "sn", "sp", "st", "sw", "th", "tr", "vr", "wr",
]);

export const LATIN_HYPHENATION_LANGUAGES: ReadonlySet<string> = new Set([
  "de", "en", "es", "fi", "fr", "hu", "id", "it",
  "nl", "pl", "pt", "pt-br", "tr", "vi",
]);

const createProfile = (
  vowels: string,
  weakVowels: string,
  accentedWeakVowels = "",
): HyphenationProfile => ({
  vowels: new Set(vowels),
  weakVowels: new Set(weakVowels),
  accentedWeakVowels: new Set(accentedWeakVowels),
});

export const DEFAULT_LATIN_HYPHENATION_PROFILE =
  createProfile("aeiou", "iu", "íú");

const portugueseProfile = createProfile("aeiou", "iu", "íú");

export const LATIN_HYPHENATION_PROFILES: ReadonlyMap<
  string,
  HyphenationProfile
> = new Map([
  ["en", createProfile("aeiouy", "iuy")],
  ["pl", createProfile("aeiouy", "iy")],
  ["pt", portugueseProfile],
  ["pt-br", portugueseProfile],
  ["es", createProfile("aeiou", "iu", "íú")],
  ["fi", createProfile("aeiouy", "iuy")],
]);

export const normalizeHyphenationLanguage = (
  value: string | undefined,
): string | undefined => {
  const candidate = value?.trim().replace(/_/gu, "-");
  if (!candidate) return undefined;

  try {
    return Intl.getCanonicalLocales(candidate)[0]?.toLowerCase();
  } catch {
    return undefined;
  }
};

export const normalizeLatinBase = (value: string): string =>
  value
    .replace(/[Ææ]/gu, "ae")
    .replace(/[Œœ]/gu, "oe")
    .replace(/[Øø]/gu, "o")
    .replace(/[Łł]/gu, "l")
    .replace(/[Đđ]/gu, "d")
    .replace(/[ẞß]/gu, "ss")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

export const isLatinHyphenationLanguage = (
  value: string | undefined,
): boolean => {
  const language = normalizeHyphenationLanguage(value);
  if (!language) return false;

  return (
    LATIN_HYPHENATION_LANGUAGES.has(language) ||
    LATIN_HYPHENATION_LANGUAGES.has(language.split("-")[0] ?? "")
  );
};

export const resolveHyphenationProfile = (
  language: string | undefined,
): HyphenationProfile => {
  const normalized = normalizeHyphenationLanguage(language);
  if (!normalized) return DEFAULT_LATIN_HYPHENATION_PROFILE;

  return (
    LATIN_HYPHENATION_PROFILES.get(normalized) ??
    LATIN_HYPHENATION_PROFILES.get(normalized.split("-")[0] ?? "") ??
    DEFAULT_LATIN_HYPHENATION_PROFILE
  );
};

export const isLatinVowel = (
  value: string,
  profile: HyphenationProfile,
): boolean =>
  Array.from(normalizeLatinBase(value)).some((char) =>
    profile.vowels.has(char),
  );

export const isLatinStrongVowel = (
  value: string,
  profile: HyphenationProfile,
): boolean =>
  Array.from(normalizeLatinBase(value)).some(
    (char) => profile.vowels.has(char) && !profile.weakVowels.has(char),
  );

export const isLatinWeakVowel = (
  value: string,
  profile: HyphenationProfile,
): boolean =>
  Array.from(normalizeLatinBase(value)).some((char) =>
    profile.weakVowels.has(char),
  );

export const isLatinAccentedWeakVowel = (
  value: string,
  profile: HyphenationProfile,
): boolean =>
  profile.accentedWeakVowels.has(value.normalize("NFC").toLowerCase());

export const canStartLatinOnset = (value: string): boolean =>
  LATIN_ALLOWED_ONSET_CLUSTERS.has(normalizeLatinBase(value));

export const shouldSplitLatinVowelPair = (
  language: string | undefined,
  profile: HyphenationProfile,
  previousChar: string | undefined,
  current: string,
  next: string,
): boolean => {
  if (!isLatinVowel(current, profile) || !isLatinVowel(next, profile)) {
    return false;
  }

  const primaryLanguage =
    normalizeHyphenationLanguage(language)?.split("-")[0];
  const currentBase = normalizeLatinBase(current);
  const nextBase = normalizeLatinBase(next);

  if (primaryLanguage === "fi" && currentBase === nextBase) {
    return false;
  }

  if (
    isLatinAccentedWeakVowel(current, profile) ||
    isLatinAccentedWeakVowel(next, profile)
  ) {
    return true;
  }

  if (
    isLatinStrongVowel(current, profile) &&
    isLatinStrongVowel(next, profile)
  ) {
    return true;
  }

  if (
    isLatinWeakVowel(current, profile) &&
    isLatinStrongVowel(next, profile)
  ) {
    const previousBase = normalizeLatinBase(previousChar ?? "");
    return !(
      currentBase === "u" &&
      (previousBase === "q" || previousBase === "g")
    );
  }

  return false;
};

export const splitLatinSyllables = (
  word: string,
  language: string | undefined,
): string[] => {
  if (!word || !LATIN_WORD_PATTERN.test(word)) return [word];

  const glyphs = splitGraphemes(word);
  const profile = resolveHyphenationProfile(language);
  const vowelIndexes: number[] = [];

  for (let index = 0; index < glyphs.length; index += 1) {
    if (isLatinVowel(glyphs[index] ?? "", profile)) {
      vowelIndexes.push(index);
    }
  }

  const boundaries: number[] = [];

  for (let index = 1; index < vowelIndexes.length; index += 1) {
    const previous = vowelIndexes[index - 1];
    const next = vowelIndexes[index];
    if (previous === undefined || next === undefined) continue;

    const clusterSize = next - previous - 1;

    if (clusterSize === 0) {
      if (
        shouldSplitLatinVowelPair(
          language,
          profile,
          glyphs[previous - 1],
          glyphs[previous] ?? "",
          glyphs[next] ?? "",
        )
      ) {
        boundaries.push(next);
      }
      continue;
    }

    const lastTwo = glyphs.slice(Math.max(previous + 1, next - 2), next);
    boundaries.push(
      clusterSize >= 2 && canStartLatinOnset(lastTwo.join(""))
        ? next - 2
        : next - 1,
    );
  }

  const syllables: string[] = [];
  let start = 0;

  for (const boundary of boundaries) {
    if (boundary <= start) continue;
    syllables.push(glyphs.slice(start, boundary).join(""));
    start = boundary;
  }

  syllables.push(glyphs.slice(start).join(""));
  return syllables;
};

export const splitTokenAffixes = (token: string): TokenAffixes | null => {
  const match = LATIN_WORD_TOKEN_PATTERN.exec(token);
  const word = match?.[2];

  return word
    ? {
        prefix: match?.[1] ?? "",
        word,
        suffix: match?.[3] ?? "",
      }
    : null;
};

export const splitGenericTokenAffixes = (
  token: string,
): TokenAffixes | null => {
  const glyphs = segmentText(token);
  let first = 0;
  let last = glyphs.length - 1;

  while (
    first <= last &&
    !/[\p{L}\p{N}]/u.test(glyphs[first]?.text ?? "")
  ) {
    first += 1;
  }

  while (
    last >= first &&
    !/[\p{L}\p{N}]/u.test(glyphs[last]?.text ?? "")
  ) {
    last -= 1;
  }

  const start = glyphs[first]?.start;
  const end = glyphs[last]?.end;

  if (start === undefined || end === undefined || last - first + 1 < 4) {
    return null;
  }

  return {
    prefix: token.slice(0, start),
    word: token.slice(start, end),
    suffix: token.slice(end),
  };
};

export const getWordBreakOffsets = (
  token: string,
  language?: string,
): number[] => {
  const parts = splitTokenAffixes(token) ?? splitGenericTokenAffixes(token);
  if (!parts) return [];

  const glyphs = segmentText(parts.word);
  if (glyphs.length < 4) return [];

  const validOffsets = new Set(
    glyphs.slice(1, -2).map((glyph) => glyph.end),
  );
  const preferred: number[] = [];

  if (isLatinHyphenationLanguage(language)) {
    let offset = 0;
    for (const syllable of splitLatinSyllables(parts.word, language)) {
      offset += syllable.length;
      if (validOffsets.has(offset)) preferred.push(offset);
    }
  }

  const offsets = new Set([
    ...preferred.reverse(),
    ...Array.from(validOffsets).reverse(),
  ]);

  return Array.from(offsets, (offset) => parts.prefix.length + offset);
};

export const splitWordToFitWidth = (
  ctx: TextMeasurer,
  token: string,
  availableWidth: number,
  hyphenationLanguage?: string,
): WordSplit | null => {
  if (!Number.isFinite(availableWidth) || availableWidth <= 0) return null;
  if (ctx.measureText(token).width <= availableWidth) return null;

  for (const offset of getWordBreakOffsets(token, hyphenationLanguage)) {
    const head = `${token.slice(0, offset)}-`;
    const width = ctx.measureText(head).width;

    if (Number.isFinite(width) && width <= availableWidth) {
      return { head, tail: token.slice(offset) };
    }
  }

  return null;
};

export const wrapParagraphAcrossLineWidths = (
  ctx: TextMeasurer,
  paragraph: string,
  lineWidths: readonly number[],
  maxLines: number,
  allowHyphenation: boolean,
  hyphenationLanguage?: string,
  strictMaxWidth = false,
): string[] | null => {
  if (
    !Number.isSafeInteger(maxLines) ||
    maxLines < 1 ||
    lineWidths.length === 0 ||
    lineWidths.some((width) => !Number.isFinite(width) || width <= 0)
  ) {
    return null;
  }

  const words = paragraph.trim().split(/[\t\f\v ]+/u).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let index = 0;
  let pending = words[0] ?? "";
  let line = "";

  const measureFits = (value: string, width: number): boolean => {
    const measured = ctx.measureText(value).width;
    return Number.isFinite(measured) && measured <= width;
  };

  while (index < words.length) {
    if (lines.length >= maxLines) return null;

    const width =
      lineWidths[Math.min(lines.length, lineWidths.length - 1)] ?? 0;
    const candidate = line ? `${line} ${pending}` : pending;

    if (measureFits(candidate, width)) {
      line = candidate;
      index += 1;
      pending = words[index] ?? "";
      continue;
    }

    let split: WordSplit | null = null;

    if (allowHyphenation) {
      for (const offset of getWordBreakOffsets(pending, hyphenationLanguage)) {
        const head = `${pending.slice(0, offset)}-`;
        const fullHead = line ? `${line} ${head}` : head;
        if (measureFits(fullHead, width)) {
          split = { head: fullHead, tail: pending.slice(offset) };
          break;
        }
      }
    }

    if (split) {
      lines.push(split.head);
      pending = split.tail;
      line = "";
    } else if (line) {
      lines.push(line);
      line = "";
    } else if (!strictMaxWidth) {
      lines.push(pending);
      index += 1;
      pending = words[index] ?? "";
    } else {
      return null;
    }
  }

  if (line) lines.push(line);
  return lines.length <= maxLines ? lines : null;
};

export const wrapParagraphGreedy = (
  ctx: TextMeasurer,
  paragraph: string,
  maxWidth: number,
  allowHyphenation: boolean,
  hyphenationLanguage?: string,
  strictMaxWidth = false,
): string[] => {
  const result = wrapParagraphAcrossLineWidths(
    ctx,
    paragraph,
    [maxWidth],
    Number.MAX_SAFE_INTEGER,
    allowHyphenation,
    hyphenationLanguage,
    strictMaxWidth,
  );

  if (!result) {
    throw new RangeError("Paragraph does not fit the requested line width.");
  }

  return result;
};

export const wrapParagraphWithProfile = wrapParagraphAcrossLineWidths;
