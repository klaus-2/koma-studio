export const LATIN_WORD_PATTERN = /^\p{Script=Latin}+$/u;
export const LATIN_WORD_TOKEN_PATTERN = /^([^\p{Script=Latin}]*)([\p{Script=Latin}]+)([^\p{Script=Latin}]*)$/u;
export const LATIN_ALLOWED_ONSET_CLUSTERS = new Set([
  "bl",
  "br",
  "ch",
  "cl",
  "cr",
  "dr",
  "fl",
  "fr",
  "gl",
  "gr",
  "gu",
  "lh",
  "nh",
  "pl",
  "pr",
  "qu",
  "sc",
  "sh",
  "sk",
  "sl",
  "sm",
  "sn",
  "sp",
  "st",
  "sw",
  "th",
  "tr",
  "vr",
  "wr",
]);

export const LATIN_HYPHENATION_LANGUAGES = new Set([
  "de",
  "en",
  "es",
  "fi",
  "fr",
  "hu",
  "id",
  "it",
  "nl",
  "pl",
  "pt",
  "pt-br",
  "tr",
  "vi",
]);

type HyphenationProfile = {
  vowels: Set<string>;
  weakVowels: Set<string>;
  accentedWeakVowels: Set<string>;
};

export const DEFAULT_LATIN_HYPHENATION_PROFILE: HyphenationProfile = {
  vowels: new Set(["a", "e", "i", "o", "u"]),
  weakVowels: new Set(["i", "u"]),
  accentedWeakVowels: new Set(["í", "ú"]),
};

export const LATIN_HYPHENATION_PROFILES = new Map<string, HyphenationProfile>([
  [
    "en",
    {
      vowels: new Set(["a", "e", "i", "o", "u", "y"]),
      weakVowels: new Set(["i", "u", "y"]),
      accentedWeakVowels: new Set(),
    },
  ],
  [
    "pl",
    {
      vowels: new Set(["a", "e", "i", "o", "u", "y"]),
      weakVowels: new Set(["i", "y"]),
      accentedWeakVowels: new Set(),
    },
  ],
  [
    "pt",
    {
      vowels: new Set(["a", "e", "i", "o", "u", "á", "à", "â", "ã", "é", "ê", "í", "ó", "ô", "õ", "ú", "ü"]),
      weakVowels: new Set(["i", "u", "í", "ú", "ü"]),
      accentedWeakVowels: new Set(["í", "ú"]),
    },
  ],
  [
    "pt-br",
    {
      vowels: new Set(["a", "e", "i", "o", "u", "á", "à", "â", "ã", "é", "ê", "í", "ó", "ô", "õ", "ú", "ü"]),
      weakVowels: new Set(["i", "u", "í", "ú", "ü"]),
      accentedWeakVowels: new Set(["í", "ú"]),
    },
  ],
]);

export const normalizeLatinBase = (value: string): string =>
  value
    .replace(/[Ææ]/g, "ae")
    .replace(/[Œœ]/g, "oe")
    .replace(/[Øø]/g, "o")
    .replace(/[Łł]/g, "l")
    .replace(/[Đđ]/g, "d")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export const isLatinHyphenationLanguage = (value: string | undefined): boolean =>
  value ? LATIN_HYPHENATION_LANGUAGES.has(value.trim().toLowerCase()) : false;

export const resolveHyphenationProfile = (language: string | undefined): HyphenationProfile => {
  const normalized = language?.trim().toLowerCase();
  if (!normalized) {
    return DEFAULT_LATIN_HYPHENATION_PROFILE;
  }
  return LATIN_HYPHENATION_PROFILES.get(normalized) ?? DEFAULT_LATIN_HYPHENATION_PROFILE;
};

export const isLatinVowel = (value: string, profile: HyphenationProfile): boolean => {
  const normalized = normalizeLatinBase(value);
  if (!normalized) {
    return false;
  }
  return Array.from(normalized).some((char) => profile.vowels.has(char));
};

export const isLatinStrongVowel = (value: string, profile: HyphenationProfile): boolean => {
  const normalized = normalizeLatinBase(value);
  if (!normalized) {
    return false;
  }
  return Array.from(normalized).some((char) => profile.vowels.has(char) && !profile.weakVowels.has(char));
};

export const isLatinWeakVowel = (value: string, profile: HyphenationProfile): boolean => {
  const normalized = normalizeLatinBase(value);
  if (!normalized) {
    return false;
  }
  return Array.from(normalized).some((char) => profile.weakVowels.has(char));
};

export const isLatinAccentedWeakVowel = (value: string, profile: HyphenationProfile): boolean =>
  profile.accentedWeakVowels.has(value.toLowerCase());

export const canStartLatinOnset = (value: string): boolean =>
  LATIN_ALLOWED_ONSET_CLUSTERS.has(normalizeLatinBase(value));

export const shouldSplitLatinVowelPair = (
  language: string | undefined,
  profile: HyphenationProfile,
  previousChar: string | undefined,
  current: string,
  next: string,
): boolean => {
  if (isLatinAccentedWeakVowel(current, profile) || isLatinAccentedWeakVowel(next, profile)) {
    return true;
  }
  if (isLatinStrongVowel(current, profile) && isLatinStrongVowel(next, profile)) {
    return true;
  }
  if (isLatinWeakVowel(current, profile) && isLatinStrongVowel(next, profile)) {
    const normalizedCurrent = normalizeLatinBase(current);
    const normalizedPrevious = normalizeLatinBase(previousChar ?? "");
    if (normalizedCurrent === "u" && (normalizedPrevious === "q" || normalizedPrevious === "g")) {
      return false;
    }
    return true;
  }
  if (language === "fi" && isLatinVowel(current, profile) && isLatinVowel(next, profile)) {
    return true;
  }
  return false;
};

export const splitLatinSyllables = (word: string, language: string | undefined): string[] => {
  const trimmed = word.trim();
  if (!trimmed || !LATIN_WORD_PATTERN.test(trimmed)) {
    return [word];
  }

  const profile = resolveHyphenationProfile(language);
  const chars = Array.from(trimmed);
  const syllables: string[] = [];
  let start = 0;

  while (start < chars.length) {
    let vowelIndex = start;
    while (vowelIndex < chars.length && !isLatinVowel(chars[vowelIndex] ?? "", profile)) {
      vowelIndex += 1;
    }

    if (vowelIndex >= chars.length) {
      if (syllables.length === 0) {
        syllables.push(chars.slice(start).join(""));
      } else {
        syllables[syllables.length - 1] += chars.slice(start).join("");
      }
      break;
    }

    let nucleusEnd = vowelIndex;
    while (nucleusEnd + 1 < chars.length && isLatinVowel(chars[nucleusEnd + 1] ?? "", profile)) {
      const previousChar = chars[nucleusEnd - 1];
      const currentChar = chars[nucleusEnd] ?? "";
      const nextChar = chars[nucleusEnd + 1] ?? "";
      if (shouldSplitLatinVowelPair(language, profile, previousChar, currentChar, nextChar)) {
        break;
      }
      nucleusEnd += 1;
    }

    let nextVowelIndex = nucleusEnd + 1;
    while (
      nextVowelIndex < chars.length
      && !isLatinVowel(chars[nextVowelIndex] ?? "", profile)
    ) {
      nextVowelIndex += 1;
    }

    if (nextVowelIndex >= chars.length) {
      syllables.push(chars.slice(start).join(""));
      break;
    }

    const consonantClusterStart = nucleusEnd + 1;
    const clusterSize = nextVowelIndex - consonantClusterStart;
    let splitIndex = nextVowelIndex;

    if (clusterSize === 1) {
      splitIndex = consonantClusterStart;
    } else if (clusterSize === 2) {
      const cluster = chars.slice(consonantClusterStart, nextVowelIndex).join("");
      splitIndex = canStartLatinOnset(cluster)
        ? consonantClusterStart
        : consonantClusterStart + 1;
    } else if (clusterSize >= 3) {
      const lastTwo = chars.slice(nextVowelIndex - 2, nextVowelIndex).join("");
      splitIndex = canStartLatinOnset(lastTwo)
        ? nextVowelIndex - 2
        : nextVowelIndex - 1;
    }

    if (splitIndex <= start) {
      splitIndex = Math.min(chars.length, start + 1);
    }

    syllables.push(chars.slice(start, splitIndex).join(""));
    start = splitIndex;
  }

  return syllables.filter((syllable) => syllable.length > 0);
};

export const splitTokenAffixes = (token: string): { prefix: string; word: string; suffix: string } | null => {
  const match = token.match(LATIN_WORD_TOKEN_PATTERN);
  if (!match) return null;
  return {
    prefix: match[1] ?? "",
    word: match[2] ?? "",
    suffix: match[3] ?? "",
  };
};

export const splitGenericTokenAffixes = (token: string): { prefix: string; word: string; suffix: string } | null => {
  const trimmed = token.trim();
  if (trimmed.length < 4) return null;

  const leadingMatch = trimmed.match(/^[^\p{L}\p{N}]*/u);
  const trailingMatch = trimmed.match(/[^\p{L}\p{N}]*$/u);
  const prefix = leadingMatch?.[0] ?? "";
  const suffix = trailingMatch?.[0] ?? "";
  const wordStart = prefix.length;
  const wordEnd = Math.max(wordStart, trimmed.length - suffix.length);
  const word = trimmed.slice(wordStart, wordEnd);

  if (word.length < 4) {
    return null;
  }

  return {
    prefix,
    word,
    suffix,
  };
};

export const splitWordToFitWidth = (
  ctx: CanvasRenderingContext2D,
  token: string,
  availableWidth: number,
  hyphenationLanguage?: string,
): { head: string; tail: string } | null => {
  if (availableWidth <= 0) return null;

  const parts = splitTokenAffixes(token) ?? splitGenericTokenAffixes(token);
  if (!parts || parts.word.length < 4) {
    return null;
  }

  const { prefix, word, suffix } = parts;
  const syllables = isLatinHyphenationLanguage(hyphenationLanguage)
    ? splitLatinSyllables(word, hyphenationLanguage)
    : Array.from(word);

  if (syllables.length >= 2) {
    for (let splitIndex = syllables.length - 1; splitIndex >= 1; splitIndex -= 1) {
      const headCore = syllables.slice(0, splitIndex).join("");
      const tailCore = syllables.slice(splitIndex).join("");
      if (headCore.length < 3 || tailCore.length < 2) {
        continue;
      }
      const head = `${prefix}${headCore}-`;
      if (ctx.measureText(head).width <= availableWidth) {
        return {
          head,
          tail: `${tailCore}${suffix}`,
        };
      }
    }
  }

  const glyphs = Array.from(word);
  for (let splitIndex = glyphs.length - 2; splitIndex >= 2; splitIndex -= 1) {
    const headCore = glyphs.slice(0, splitIndex).join("");
    const tailCore = glyphs.slice(splitIndex).join("");
    const head = `${prefix}${headCore}-`;
    if (ctx.measureText(head).width <= availableWidth) {
      return {
        head,
        tail: `${tailCore}${suffix}`,
      };
    }
  }

  return null;
};

export const wrapParagraphAcrossLineWidths = (
  ctx: CanvasRenderingContext2D,
  paragraph: string,
  lineWidths: number[],
  maxLines: number,
  allowHyphenation: boolean,
  hyphenationLanguage?: string,
  strictMaxWidth = false,
): string[] | null => {
  const trimmed = paragraph.trim();
  if (!trimmed) {
    return [""];
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [""];
  }

  const lines: string[] = [];
  let currentLine = "";
  let lineIndex = 0;

  while (words.length > 0) {
    const maxWidth = lineWidths[Math.min(lineWidths.length - 1, lineIndex)] ?? lineWidths[lineWidths.length - 1] ?? 1;
    const nextWord = words[0] ?? "";
    const candidate = currentLine ? `${currentLine} ${nextWord}` : nextWord;

    if (ctx.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
      words.shift();
      continue;
    }

    if (!allowHyphenation && !currentLine) {
      if (strictMaxWidth) {
        return null;
      }
      currentLine = nextWord;
      words.shift();
      continue;
    }

    const remainingWidth = currentLine
      ? Math.max(1, maxWidth - ctx.measureText(`${currentLine} `).width)
      : maxWidth;
    const hyphenated = allowHyphenation
      ? splitWordToFitWidth(ctx, nextWord, remainingWidth, hyphenationLanguage)
      : null;

    if (hyphenated) {
      lines.push(currentLine ? `${currentLine} ${hyphenated.head}` : hyphenated.head);
      lineIndex += 1;
      if (lineIndex >= maxLines) {
        return null;
      }
      words[0] = hyphenated.tail;
      currentLine = "";
      continue;
    }

    if (!currentLine) {
      return null;
    }

    lines.push(currentLine);
    lineIndex += 1;
    if (lineIndex >= maxLines) {
      return null;
    }
    currentLine = "";
  }

  if (currentLine || lines.length === 0) {
    lines.push(currentLine);
  }

  return lines.length <= maxLines ? lines : null;
};

export const wrapParagraphGreedy = (
  ctx: CanvasRenderingContext2D,
  paragraph: string,
  maxWidth: number,
  allowHyphenation: boolean,
  hyphenationLanguage?: string,
  strictMaxWidth = false,
): string[] => {
  return wrapParagraphAcrossLineWidths(
    ctx,
    paragraph,
    [maxWidth],
    Number.MAX_SAFE_INTEGER,
    allowHyphenation,
    hyphenationLanguage,
    strictMaxWidth,
  )
    ?? [paragraph.trim()];
};

export const wrapParagraphWithProfile = (
  ctx: CanvasRenderingContext2D,
  paragraph: string,
  lineWidths: number[],
  maxLines: number,
  allowHyphenation: boolean,
  hyphenationLanguage?: string,
  strictMaxWidth = false,
): string[] | null => {
  return wrapParagraphAcrossLineWidths(
    ctx,
    paragraph,
    lineWidths,
    maxLines,
    allowHyphenation,
    hyphenationLanguage,
    strictMaxWidth,
  );
};
