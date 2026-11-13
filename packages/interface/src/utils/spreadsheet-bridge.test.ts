import { describe, expect, it } from "vitest";

import {
  applySheetRows,
  buildRegionLookup,
  buildSheetRowId,
  buildSheetRows,
  type SheetRow,
} from "@/utils/spreadsheet-bridge";
import type { TypographyRegion } from "@/typography/types";
import type { LoadedImage } from "@/types/dashboard.types";
import type { DirectPageFile } from "@/utils/page-source";

const pageFile = (name: string): DirectPageFile => ({
  kind: "direct",
  name,
  type: "image/png",
  size: 1,
  lastModified: 0,
  toBlob: () => Promise.resolve(new Blob()),
  dimensions: () => Promise.resolve({ width: 1, height: 1 }),
  release: () => undefined,
  resident: new File([], name),
});

const image = (id: string, chapterLabel?: string): LoadedImage => ({
  id,
  file: pageFile(`${id}.png`),
  url: `blob:${id}`,
  width: 100,
  height: 100,
  rotation: 0,
  filters: {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    sharpen: 0,
    levels: { black: 0, white: 255, gamma: 1 },
    grayscale: false,
    inverted: false,
  },
  ...(chapterLabel === undefined ? {} : { chapterLabel }),
});

const region = (
  id: string,
  recognizedText: string,
  translatedText: string,
  translatorModelKey?: string,
): TypographyRegion => ({
  id,
  bbox: [0, 0, 100, 40],
  score: 1,
  source: "model",
  modelKey: "test-model",
  recognizedText,
  translatedText,
  ...(translatorModelKey === undefined ? {} : { translatorModelKey }),
});

const row = (
  imageId: string,
  regionId: string,
  ocrText: string,
  translation: string,
): SheetRow => ({
  imageId,
  regionId,
  chapterLabel: "",
  ocrText,
  translation,
  notes: "",
});

describe("buildSheetRows", () => {
  it("maps image chapter labels, OCR text, translation and notes into rows", () => {
    const r1 = region("r1", "こんにちは", "Hello", "qwen-engine");
    const r1WithNotes = { ...r1, notes: ["keep tone", "short"] };
    const rows = buildSheetRows([image("img-1", "Chapter 01")], {
      "img-1": [r1WithNotes],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      imageId: "img-1",
      regionId: "r1",
      chapterLabel: "Chapter 01",
      ocrText: "こんにちは",
      translation: "Hello",
      notes: "keep tone | short",
    });
  });

  it("skips images without regions and defaults missing chapter labels", () => {
    const rows = buildSheetRows(
      [image("img-1"), image("img-2", "Chapter 02")],
      { "img-2": [region("r2", "ドン", "Boom")] },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      imageId: "img-2",
      chapterLabel: "Chapter 02",
      notes: "",
    });
  });
});

describe("applySheetRows — roundtrip", () => {
  it("reimports an untouched export with zero applies, manual_edit rows untouched", () => {
    const images = [image("img-1", "Chapter 01")];
    const regionsByImage = {
      "img-1": [
        region("r1", "こんにちは", "Hello", "qwen-engine"),
        region("r2", "ドン", "Boom", "manual_edit"),
      ],
    };
    const rows = buildSheetRows(images, regionsByImage);
    const result = applySheetRows(rows, buildRegionLookup(images, regionsByImage));
    expect(result.applied).toBe(0);
    expect(result.skipped).toBe(2);
    expect(result.conflicts).toEqual([]);
    expect(result.appliedRows).toEqual([]);
    expect(result.skippedRows.map((entry) => entry.reason)).toEqual([
      "unchanged",
      "unchanged",
    ]);
  });

  it("treats NFKC-equivalent sheet text as unchanged", () => {
    const images = [image("img-1")];
    const rows = [row("img-1", "r1", "Ｔｏｔａｌ：１００", "Ｈｅｌｌｏ")];
    const result = applySheetRows(
      rows,
      buildRegionLookup(images, {
        "img-1": [region("r1", "Total:100", "Hello")],
      }),
    );
    expect(result.applied).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.skippedRows[0]).toMatchObject({ reason: "unchanged" });
  });
});

describe("applySheetRows — match ladder", () => {
  it("applies a correction on the exact (imageId, regionId) match", () => {
    const images = [image("img-1")];
    const rows = [row("img-1", "r1", "こんにちは", "Good afternoon")];
    const result = applySheetRows(
      rows,
      buildRegionLookup(images, {
        "img-1": [region("r1", "こんにちは", "Hello", "qwen-engine")],
      }),
    );
    expect(result.applied).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.appliedRows[0]).toMatchObject({
      rowId: buildSheetRowId("img-1", "r1"),
      imageId: "img-1",
      rowRegionId: "r1",
      matchedRegionId: "r1",
      matchedVia: "exact",
      translation: "Good afternoon",
      conflictOverride: false,
    });
  });

  it("falls back to the NFKC(ocr) match when the region id changed", () => {
    const images = [image("img-1")];
    const rows = [row("img-1", "old-id", "Ｈｅｌｌｏ ｗｏｒｌｄ", "Hi")];
    const result = applySheetRows(
      rows,
      buildRegionLookup(images, {
        "img-1": [region("new-id", "Hello world", "Hello", "qwen-engine")],
      }),
    );
    expect(result.applied).toBe(1);
    expect(result.appliedRows[0]).toMatchObject({
      matchedRegionId: "new-id",
      matchedVia: "nfkc_ocr",
    });
    expect(result.skippedRows).toEqual([]);
  });

  it("keeps repeated OCR texts from absorbing more than one correction", () => {
    const images = [image("img-1")];
    const rows = [
      row("img-1", "stale-a", "ドン", "First"),
      row("img-1", "stale-b", "ドン", "Second"),
    ];
    const result = applySheetRows(
      rows,
      buildRegionLookup(images, {
        "img-1": [
          region("fresh-a", "ドン", "A", "qwen-engine"),
          region("fresh-b", "ドン", "B", "qwen-engine"),
        ],
      }),
    );
    expect(result.applied).toBe(2);
    expect(result.appliedRows.map((entry) => entry.matchedRegionId)).toEqual([
      "fresh-a",
      "fresh-b",
    ]);
  });

  it("prefers an unclaimed candidate on the row's own image over other images", () => {
    const images = [image("img-1"), image("img-2")];
    const rows = [row("img-2", "stale-id", "ドン", "Boom")];
    const result = applySheetRows(
      rows,
      buildRegionLookup(images, {
        "img-1": [region("other", "ドン", "A", "qwen-engine")],
        "img-2": [region("mine", "ドン", "B", "qwen-engine")],
      }),
    );
    expect(result.appliedRows[0]).toMatchObject({
      matchedRegionId: "mine",
      matchedVia: "nfkc_ocr",
    });
  });

  it("skips rows that match neither ladder rung", () => {
    const images = [image("img-1")];
    const rows = [row("img-1", "gone", "消えた", "Whatever")];
    const result = applySheetRows(
      rows,
      buildRegionLookup(images, {
        "img-1": [region("r1", "別のテキスト", "Hello", "qwen-engine")],
      }),
    );
    expect(result.applied).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.skippedRows[0]).toMatchObject({
      imageId: "img-1",
      regionId: "gone",
      reason: "unmatched",
    });
  });
});

describe("applySheetRows — manual edit protection", () => {
  it("flags a diverging manual_edit region as CONFLICT, skipped by default", () => {
    const images = [image("img-1")];
    const rows = [row("img-1", "r1", "ドン", "Sheet edit")];
    const regionsByImage = {
      "img-1": [region("r1", "ドン", "Hand-fixed", "manual_edit")],
    };
    const defaultRun = applySheetRows(
      rows,
      buildRegionLookup(images, regionsByImage),
    );
    expect(defaultRun.applied).toBe(0);
    expect(defaultRun.skipped).toBe(1);
    expect(defaultRun.appliedRows).toEqual([]);
    expect(defaultRun.conflicts).toHaveLength(1);
    expect(defaultRun.conflicts[0]).toMatchObject({
      rowId: buildSheetRowId("img-1", "r1"),
      imageId: "img-1",
      regionId: "r1",
      sheetTranslation: "Sheet edit",
      currentTranslation: "Hand-fixed",
      resolved: false,
    });

    // Per-row opt-in applies exactly that row and marks the conflict resolved.
    const overrideRun = applySheetRows(
      rows,
      buildRegionLookup(images, regionsByImage),
      { applyConflictRowIds: new Set([buildSheetRowId("img-1", "r1")]) },
    );
    expect(overrideRun.applied).toBe(1);
    expect(overrideRun.skipped).toBe(0);
    expect(overrideRun.appliedRows[0]).toMatchObject({
      matchedRegionId: "r1",
      translation: "Sheet edit",
      conflictOverride: true,
    });
    expect(overrideRun.conflicts[0]).toMatchObject({ resolved: true });
  });

  it("catches a hand-edited engine region (post-fix stamped manual_edit) as CONFLICT", () => {
    const images = [image("img-1")];
    // Export snapshot taken BEFORE the hand edit: the region was engine-keyed.
    const exportedRows = buildSheetRows(images, {
      "img-1": [region("r1", "こんにちは", "Hello", "qwen-engine")],
    });
    // Hand edit in KŌMA — applyEditedRegionTranslation now stamps
    // manual_edit UNCONDITIONALLY, so the reimport conflict predicate fires.
    const editedRegions = {
      "img-1": [region("r1", "こんにちは", "Hand edit", "manual_edit")],
    };
    const result = applySheetRows(
      exportedRows,
      buildRegionLookup(images, editedRegions),
    );
    expect(result.applied).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]).toMatchObject({
      sheetTranslation: "Hello",
      currentTranslation: "Hand edit",
      resolved: false,
    });
  });
});

describe("applySheetRows — applied rows report", () => {
  it("applies every differing engine row and lists each in the report", () => {
    const images = [image("img-1"), image("img-2")];
    const rows = [
      row("img-1", "r1", "こんにちは", "Hello there"),
      row("img-2", "r9", "待って", "Wait up"),
    ];
    const result = applySheetRows(
      rows,
      buildRegionLookup(images, {
        "img-1": [region("r1", "こんにちは", "Hello", "qwen-engine")],
        "img-2": [region("r9", "待って", "", "qwen-engine")],
      }),
    );
    expect(result.applied).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.conflicts).toEqual([]);
    expect(result.skippedRows).toEqual([]);
    expect(result.appliedRows.map((entry) => entry.matchedRegionId)).toEqual([
      "r1",
      "r9",
    ]);
    expect(
      result.appliedRows.every(
        (entry) => entry.conflictOverride === false && entry.matchedVia === "exact",
      ),
    ).toBe(true);
  });
});
