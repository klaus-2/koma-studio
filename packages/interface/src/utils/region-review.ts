import type { TypographyRegion } from "../typography/types";

export type RegionIssueKind =
  | "untranslated"
  | "empty"
  | "cjk_leftover"
  | "overflow";

export interface RegionIssue {
  kind: RegionIssueKind;
  imageId: string;
  regionId: string;
  detail: string;
}

/**
 * Inclusive Unicode ranges scanned for CJK/Korean leftovers in a translation:
 * Hangul jamo, Hiragana/Katakana, CJK ideographs (extensions A/B + unified +
 * compatibility), Hangul syllables and fullwidth forms.
 */
const CJK_LEFTOVER_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x1100, 0x11ff],
  [0x3040, 0x30ff],
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xac00, 0xd7af],
  [0xf900, 0xfaff],
  [0xff00, 0xffef],
  [0x20000, 0x2a6df],
];

const DETAIL_MAX_CHARS = 80;

const normalizeTargetLang = (targetLang: string): string =>
  targetLang.trim().toLowerCase().replaceAll("_", "-");

/**
 * The CJK leftover rule is meaningless when the target language is itself
 * CJK: legitimate ja/ko/zh output would be mass-flagged. `targetLang` is the
 * AIO target language (the `aioTgtLang` store value from
 * `aio-pipeline.catalog.build.ts`).
 */
const isCjkTargetLanguage = (targetLang: string): boolean => {
  const normalized = normalizeTargetLang(targetLang);
  return (
    normalized === "ja" ||
    normalized === "ko" ||
    normalized === "zh" ||
    normalized.startsWith("zh-")
  );
};

const containsCjkLeftover = (text: string): boolean => {
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code === undefined) continue;
    for (const [min, max] of CJK_LEFTOVER_RANGES) {
      if (code >= min && code <= max) return true;
    }
  }
  return false;
};

const collapseWhitespace = (text: string): string =>
  text.replace(/\s+/g, " ").trim();

const buildIssueDetail = (
  translatedText: string,
  recognizedText: string,
): string => {
  const translated = collapseWhitespace(translatedText);
  const recognized = collapseWhitespace(recognizedText);
  const preview = translated.length > 0 ? translated : recognized;
  return preview.length > DETAIL_MAX_CHARS
    ? `${preview.slice(0, DETAIL_MAX_CHARS)}…`
    : preview;
};

const resolveIssueKind = (
  recognizedText: string,
  translatedText: string,
  skipCjkCheck: boolean,
): RegionIssueKind | null => {
  if (translatedText.trim().length === 0) return "empty";
  if (
    recognizedText.normalize("NFKC") === translatedText.normalize("NFKC")
  ) {
    return "untranslated";
  }
  if (!skipCjkCheck && containsCjkLeftover(translatedText)) {
    return "cjk_leftover";
  }
  return null;
};

/**
 * Derive the pending review issues for one image's regions. Pure — no store
 * reads/writes, no persistence; the caller recomputes it from existing state.
 *
 * At most one issue per region, first matching rule wins (empty > untranslated
 * > cjk_leftover). `overflow` is part of the union but NOT produced here — the
 * render-stage overflow derivation plugs into the same union later.
 */
export const deriveRegionIssues = (
  imageId: string,
  regions: TypographyRegion[],
  targetLang: string,
): RegionIssue[] => {
  const skipCjkCheck = isCjkTargetLanguage(targetLang);
  const issues: RegionIssue[] = [];
  for (const region of regions) {
    const translatedText = region.translatedText ?? "";
    const recognizedText = region.recognizedText ?? "";
    const kind = resolveIssueKind(recognizedText, translatedText, skipCjkCheck);
    if (kind === null) continue;
    issues.push({
      kind,
      imageId,
      regionId: region.id,
      detail: buildIssueDetail(translatedText, recognizedText),
    });
  }
  return issues;
};
