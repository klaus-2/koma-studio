import { describe, expect, it } from "vitest";
import {
  areRenderTextStyleRangesEqual,
  cloneRenderTextStyleRanges,
  collectInlineRenderTextFontFamilies,
  normalizeSelectionBounds,
  pickInlineRenderTextStylePatch,
  resolveInlineStyleRuns,
  styleValuesEqual,
} from "@/utils/renderTextStyleRanges";

describe("inline style intervals", () => {
  it("uses last-range-wins independently for each property", () => {
    expect(
      resolveInlineStyleRuns(6, [
        { start: 0, end: 6, style: { bold: true, color: "#111111" } },
        { start: 2, end: 4, style: { color: "#ffffff" } },
      ]),
    ).toEqual([
      { start: 0, end: 2, style: { bold: true, color: "#111111" } },
      { start: 2, end: 4, style: { bold: true, color: "#ffffff" } },
      { start: 4, end: 6, style: { bold: true, color: "#111111" } },
    ]);
  });

  it("restores lower-priority ranges after nested ranges end", () => {
    expect(
      resolveInlineStyleRuns(10, [
        { start: 0, end: 10, style: { bold: true } },
        { start: 2, end: 8, style: { bold: false } },
        { start: 3, end: 4, style: { bold: true } },
      ]).map(({ start, end, style }) => [start, end, style.bold]),
    ).toEqual([
      [0, 2, true],
      [2, 3, false],
      [3, 4, true],
      [4, 8, false],
      [8, 10, true],
    ]);
  });

  it("merges adjacent equivalent runs", () => {
    expect(
      resolveInlineStyleRuns(4, [
        { start: 0, end: 2, style: { bold: true } },
        { start: 2, end: 4, style: { bold: true } },
      ]),
    ).toEqual([{ start: 0, end: 4, style: { bold: true } }]);
  });

  it("normalizes reversed and out-of-bounds selections", () => {
    expect(normalizeSelectionBounds(10, 20, -2)).toEqual({
      start: 0,
      end: 10,
    });
    expect(() => normalizeSelectionBounds(10, NaN, 2)).toThrow(RangeError);
  });

  it("does not allocate per-character patches", () => {
    expect(
      resolveInlineStyleRuns(1_000_000, [
        { start: 10, end: 20, style: { italic: true } },
      ]),
    ).toHaveLength(3);
  });

  it("filters non-inline properties", () => {
    expect(
      pickInlineRenderTextStylePatch({
        bold: true,
        alignment: "center",
      } as never),
    ).toEqual({ bold: true });
  });

  it("compares property values without depending on insertion order", () => {
    expect(
      styleValuesEqual(
        { bold: true, color: "#fff" },
        { color: "#fff", bold: true },
      ),
    ).toBe(true);
    expect(styleValuesEqual([1, 2], [2, 1])).toBe(false);
    expect(styleValuesEqual(null, {})).toBe(false);
  });

  it("clones ranges and treats absent lists as equivalent", () => {
    const source = [{ start: 0, end: 1, style: { bold: true } }];
    const cloned = cloneRenderTextStyleRanges(source);

    expect(cloned).toEqual(source);
    expect(cloned).not.toBe(source);
    expect(cloned?.[0]?.style).not.toBe(source[0]?.style);
    expect(areRenderTextStyleRangesEqual(undefined, [])).toBe(true);
  });

  it("collects unique normalized family names", () => {
    expect(
      collectInlineRenderTextFontFamilies([
        { style: { fontFamily: " Arial " } },
        { style: { fontFamily: "Arial" } },
        {},
      ]),
    ).toEqual(["Arial"]);
  });
});
