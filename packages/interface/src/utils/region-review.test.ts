import { describe, expect, it } from "vitest";

import { deriveRegionIssues, type RegionIssue } from "@/utils/region-review";
import type { TypographyRegion } from "@/typography/types";

const region = (
  id: string,
  recognizedText: string,
  translatedText: string,
): TypographyRegion => ({
  id,
  bbox: [0, 0, 100, 40],
  score: 1,
  source: "model",
  modelKey: "test-model",
  recognizedText,
  translatedText,
});

const kindsOf = (issues: RegionIssue[]): string[] =>
  issues.map((issue) => issue.kind);

describe("deriveRegionIssues", () => {
  it("flags cjk_leftover for a JA=>EN run whose translation still holds kana/ideographs", () => {
    const issues = deriveRegionIssues(
      "image-1",
      [
        region("r1", "先輩は今日も遅刻した", "My senpai is late again先輩"),
        region("r2", "明日の予定を教えて", "Tell me your plansあした"),
        region("r3", "これは高価な花瓶です", "This vase is expensive그리고"),
        // Fullwidth forms are scanned, but NFKC(１００) === NFKC(100) makes
        // this text identical to the OCR — the untranslated rule wins first.
        region("r4", "Total: 100", "Total: １００"),
      ],
      "en",
    );
    expect(kindsOf(issues)).toEqual([
      "cjk_leftover",
      "cjk_leftover",
      "cjk_leftover",
      "untranslated",
    ]);
    expect(issues.every((issue) => issue.imageId === "image-1")).toBe(true);
    expect(issues[0]).toMatchObject({
      regionId: "r1",
      detail: "My senpai is late again先輩",
    });
  });

  it("does NOT flag legitimate kana/ideograph target output when targetLang is ja", () => {
    const issues = deriveRegionIssues(
      "image-1",
      [
        region("r1", "He was late again.", "彼はまた遅刻した。"),
        region("r2", "This vase is expensive.", "この花瓶は高価です。"),
      ],
      "ja",
    );
    expect(issues).toEqual([]);
  });

  it("flags identical OCR/translation text as untranslated", () => {
    const issues = deriveRegionIssues(
      "image-1",
      [region("r1", "Same text here", "Same text here")],
      "en",
    );
    expect(kindsOf(issues)).toEqual(["untranslated"]);
    expect(issues[0]).toMatchObject({ imageId: "image-1", regionId: "r1" });
  });

  it("flags blank or whitespace-only translations as empty", () => {
    const issues = deriveRegionIssues(
      "image-1",
      [region("r1", "Hello there", "   ")],
      "en",
    );
    expect(kindsOf(issues)).toEqual(["empty"]);
    expect(issues[0]).toMatchObject({ detail: "Hello there" });
  });

  it("produces zero issues for clean regions", () => {
    const issues = deriveRegionIssues(
      "image-1",
      [
        region("r1", "こんにちは", "Hello"),
        region("r2", "Goodbye", "Farewell"),
      ],
      "en",
    );
    expect(issues).toEqual([]);
  });

  it("skips the CJK leftover rule for a zh-tw target", () => {
    const issues = deriveRegionIssues(
      "image-1",
      [region("r1", "He was late again.", "他遲到了。")],
      "zh-tw",
    );
    expect(issues).toEqual([]);
  });

  it("normalizes target language case and underscores before comparing", () => {
    const flagged = deriveRegionIssues(
      "image-1",
      [region("r1", "先輩は遅刻した", "先輩は遅刻したよ")],
      "  JA ",
    );
    expect(flagged).toEqual([]);

    const notSkipped = deriveRegionIssues(
      "image-1",
      [region("r1", "先輩は遅刻した", "先輩は遅刻したよ")],
      "ZH_TW",
    );
    expect(kindsOf(notSkipped)).toEqual([]);
  });

  it("never emits the overflow kind — that is derived by the render stage", () => {
    const issues = deriveRegionIssues(
      "image-1",
      [
        region("r1", "先輩は遅刻した", "先輩は遅刻した"),
        region("r2", "Hello", ""),
        region("r3", "Welcome back", "Welcome back"),
        region("r4", "Hi", "Hi againおはよう"),
      ],
      "en",
    );
    expect(issues.length).toBeGreaterThan(0);
    expect(kindsOf(issues).every((kind) => kind !== "overflow")).toBe(true);
  });

  it("emits at most one issue per region, empty before untranslated before cjk", () => {
    const issues = deriveRegionIssues(
      "image-1",
      [
        region("r-blank", "こんにちは", "  "),
        region("r-same", "こんにちは", "こんにちは"),
        region("r-cjk", "こんにちは", "Hello Worldこん"),
      ],
      "en",
    );
    expect(issues).toHaveLength(3);
    expect(kindsOf(issues)).toEqual(["empty", "untranslated", "cjk_leftover"]);
  });

  it("collapses and truncates the detail preview", () => {
    const longText = `Word ${"x".repeat(200)}`;
    const issues = deriveRegionIssues(
      "image-1",
      [region("r1", longText, longText)],
      "en",
    );
    expect(issues[0]?.detail).toHaveLength(81);
    expect(issues[0]?.detail.endsWith("…")).toBe(true);
  });
});
