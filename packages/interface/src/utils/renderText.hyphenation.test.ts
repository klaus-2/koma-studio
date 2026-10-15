import { describe, expect, it } from "vitest";
import {
  getWordBreakOffsets,
  isLatinAccentedWeakVowel,
  isLatinHyphenationLanguage,
  normalizeLatinBase,
  resolveHyphenationProfile,
  splitGenericTokenAffixes,
  splitLatinSyllables,
  splitTokenAffixes,
  splitWordToFitWidth,
  wrapParagraphAcrossLineWidths,
  wrapParagraphGreedy,
} from "@/utils/renderText.hyphenation";
import type { TextMeasurer } from "@/utils/renderText.hyphenation";
import { segmentText } from "@/utils/renderText.unicode";

const measure: TextMeasurer = {
  measureText: (text) => ({ width: segmentText(text).length }),
};

describe("Unicode-safe hyphenation", () => {
  it("normalizes language variants", () => {
    expect(isLatinHyphenationLanguage(" PT_br ")).toBe(true);
    expect(isLatinHyphenationLanguage("en-US")).toBe(true);
    expect(isLatinHyphenationLanguage("not a language")).toBe(false);
    expect(isLatinHyphenationLanguage(undefined)).toBe(false);
  });

  it("recognizes decomposed accents", () => {
    const profile = resolveHyphenationProfile("pt-BR");

    expect(isLatinAccentedWeakVowel("i\u0301", profile)).toBe(true);
    expect(normalizeLatinBase("ÆŒØŁĐẞ")).toBe("aeoeoldss");
  });

  it("preserves source text when splitting syllables", () => {
    for (const word of ["saúde", "sau\u0301de", "banana", "strengths"]) {
      expect(splitLatinSyllables(word, "pt-BR").join("")).toBe(word);
    }

    expect(splitLatinSyllables("hello-world", "en")).toEqual(["hello-world"]);
    expect(splitLatinSyllables("", "en")).toEqual([""]);
  });

  it("preserves affixes and combining marks", () => {
    expect(splitTokenAffixes("(sau\u0301de!)")).toEqual({
      prefix: "(",
      word: "sau\u0301de",
      suffix: "!)",
    });

    expect(splitGenericTokenAffixes("「東京大学」")).toEqual({
      prefix: "「",
      word: "東京大学",
      suffix: "」",
    });

    expect(splitGenericTokenAffixes("!!!")).toBeNull();
  });

  it("only exposes grapheme boundaries", () => {
    const word = "abce\u0301fghi";
    const boundaries = new Set(segmentText(word).map((glyph) => glyph.end));

    for (const offset of getWordBreakOffsets(word, "pt")) {
      expect(boundaries.has(offset)).toBe(true);
    }
  });

  it("does not split a word which already fits", () => {
    expect(splitWordToFitWidth(measure, "banana", 20, "pt")).toBeNull();
    expect(splitWordToFitWidth(measure, "banana", NaN, "pt")).toBeNull();
    expect(splitWordToFitWidth(measure, "banana", 0, "pt")).toBeNull();
  });

  it("preserves token content after removing the inserted hyphen", () => {
    const split = splitWordToFitWidth(measure, "(banana)", 5, "pt");

    expect(split).not.toBeNull();
    expect(`${split?.head.slice(0, -1)}${split?.tail}`).toBe("(banana)");
  });
});

describe("paragraph wrapping", () => {
  it("respects line limits and validates widths", () => {
    expect(
      wrapParagraphAcrossLineWidths(measure, "one two", [3], 1, false, undefined, true),
    ).toBeNull();

    expect(
      wrapParagraphAcrossLineWidths(measure, "", [], 1, false),
    ).toBeNull();

    expect(
      wrapParagraphAcrossLineWidths(measure, "", [4], 0, false),
    ).toBeNull();

    expect(
      wrapParagraphAcrossLineWidths(measure, "", [4], 1, false),
    ).toEqual([""]);
  });

  it("reuses the final width without removing items from the queue", () => {
    expect(
      wrapParagraphAcrossLineWidths(measure, "one two six", [3], 3, false),
    ).toEqual(["one", "two", "six"]);
  });

  it("does not silently ignore strict mode", () => {
    expect(() =>
      wrapParagraphGreedy(measure, "unbreakable", 2, false, undefined, true),
    ).toThrow(RangeError);
  });

  it("allows overflow only when explicitly non-strict", () => {
    expect(
      wrapParagraphGreedy(measure, "unbreakable", 2, false),
    ).toEqual(["unbreakable"]);
  });

  it("measures the complete candidate instead of subtracting widths", () => {
    const nonAdditive: TextMeasurer = {
      measureText: (text) => ({
        width: text === "a bana-" ? 100 : text.length,
      }),
    };

    const result = wrapParagraphAcrossLineWidths(
      nonAdditive,
      "a banana",
      [7],
      4,
      true,
      "pt",
      true,
    );

    expect(result).not.toContain("a bana-");
    expect(result?.every((line) => nonAdditive.measureText(line).width <= 7))
      .toBe(true);
  });
});
