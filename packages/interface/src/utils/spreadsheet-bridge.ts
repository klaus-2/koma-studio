import type { LoadedImage } from "../types/dashboard.types";
import type { TypographyRegion } from "../typography/types";

/**
 * Bilingual spreadsheet bridge (Feature 3) — pure domain logic for the
 * CSV/XLSX correction roundtrip. SheetJS serialization/parsing lives in
 * `pages/dashboard/hooks/exportSheetWorker.ts`; this module never imports it.
 *
 * Match ladder applied per imported row: (1) exact `(imageId, regionId)`;
 * (2) an NFKC(ocrText) fallback for regions that were re-detected after the
 * export (region ids changed). No fuzzy matching anywhere.
 *
 * Residual risk (stated, by design): divergence on engine-keyed rows cannot
 * distinguish a reviewer correction made in the sheet from an edit made in
 * KŌMA after the export — the full applied-rows report emitted here is the
 * mitigation.
 */

/** Provenance key stamped on regions whose translation was hand-edited. */
const MANUAL_EDIT_KEY = "manual_edit";

export interface SheetRow {
  readonly imageId: string;
  readonly regionId: string;
  readonly chapterLabel: string;
  readonly ocrText: string;
  readonly translation: string;
  readonly notes: string;
}

export type SheetMatchStrategy = "exact" | "nfkc_ocr";

export type SheetSkipReason = "unchanged" | "unmatched" | "duplicate";

/** A region addressable through the NFKC(ocr) fallback index. */
export interface SheetOcrCandidate {
  readonly imageId: string;
  readonly region: TypographyRegion;
}

/**
 * Concrete region index built ONCE per reimport (see `buildRegionLookup`) —
 * `byId` resolves `(imageId, regionId)` and `byOcr` indexes regions by their
 * NFKC-normalized OCR text. No inline function types.
 */
export interface RegionLookup {
  readonly byId: ReadonlyMap<string, ReadonlyMap<string, TypographyRegion>>;
  readonly byOcr: ReadonlyMap<string, readonly SheetOcrCandidate[]>;
}

export interface SheetConflict {
  readonly rowId: string;
  readonly imageId: string;
  readonly regionId: string;
  readonly sheetTranslation: string;
  readonly currentTranslation: string;
  /** True when the user explicitly opted in to applying this conflict. */
  readonly resolved: boolean;
}

export interface SheetAppliedRow {
  readonly rowId: string;
  /** Image id as declared by the imported row (may be stale after a re-upload). */
  readonly imageId: string;
  /**
   * Image that actually holds the matched region — `imageId` for exact
   * matches, the OCR candidate's image for fallback matches. The write-back
   * groups by THIS id: a stale row image id must not silently drop the
   * correction.
   */
  readonly matchedImageId: string;
  /** Region id as declared by the imported row (may differ on OCR fallback). */
  readonly rowRegionId: string;
  readonly matchedRegionId: string;
  readonly matchedVia: SheetMatchStrategy;
  readonly translation: string;
  /** True when this row is a manual-edit conflict the user opted in to apply. */
  readonly conflictOverride: boolean;
}

export interface SheetSkippedRow {
  readonly rowId: string;
  readonly imageId: string;
  readonly regionId: string;
  readonly reason: SheetSkipReason;
}

export interface SheetApplyOptions {
  /** Row ids whose manual-edit conflicts the user explicitly chose to apply. */
  readonly applyConflictRowIds?: ReadonlySet<string>;
}

export interface SheetApplyResult {
  readonly applied: number;
  readonly skipped: number;
  readonly appliedRows: readonly SheetAppliedRow[];
  readonly skippedRows: readonly SheetSkippedRow[];
  readonly conflicts: readonly SheetConflict[];
}

export interface SheetReimportReport {
  readonly appliedRows: readonly SheetAppliedRow[];
  readonly skippedRows: readonly SheetSkippedRow[];
  readonly conflicts: readonly SheetConflict[];
}

const nfkcKey = (text: string): string => text.normalize("NFKC").trim();

/** Stable per-row identity used by the conflict opt-in. */
export const buildSheetRowId = (imageId: string, regionId: string): string =>
  `${imageId}␟${regionId}`;

/**
 * One row per region of every loaded image, in image/region order. Rows feed
 * the sheet worker's serializer directly — the column set matches `SheetRow`.
 */
export const buildSheetRows = (
  images: readonly LoadedImage[],
  regionsByImage: Readonly<Record<string, readonly TypographyRegion[]>>,
): SheetRow[] => {
  const rows: SheetRow[] = [];
  for (const image of images) {
    const chapterLabel = image.chapterLabel ?? "";
    for (const region of regionsByImage[image.id] ?? []) {
      rows.push({
        imageId: image.id,
        regionId: region.id,
        chapterLabel,
        ocrText: region.recognizedText ?? "",
        translation: region.translatedText ?? "",
        notes: (region.notes ?? []).join(" | "),
      });
    }
  }
  return rows;
};

/**
 * Builds the reimport lookup from the currently loaded images only (stale
 * regions of unloaded images are excluded). The NFKC(ocr) index keeps every
 * candidate region so duplicate OCR texts (repeated SFX across pages) can be
 * consumed claim-based by `applySheetRows` instead of colliding.
 */
export const buildRegionLookup = (
  images: readonly LoadedImage[],
  regionsByImage: Readonly<Record<string, readonly TypographyRegion[]>>,
): RegionLookup => {
  const byId = new Map<string, Map<string, TypographyRegion>>();
  const byOcr = new Map<string, SheetOcrCandidate[]>();
  for (const image of images) {
    const imageIndex = new Map<string, TypographyRegion>();
    byId.set(image.id, imageIndex);
    for (const region of regionsByImage[image.id] ?? []) {
      imageIndex.set(region.id, region);
      const ocrKey = nfkcKey(region.recognizedText ?? "");
      if (ocrKey.length === 0) continue;
      const candidates = byOcr.get(ocrKey);
      if (candidates) {
        candidates.push({ imageId: image.id, region });
      } else {
        byOcr.set(ocrKey, [{ imageId: image.id, region }]);
      }
    }
  }
  return { byId, byOcr };
};

/**
 * NFKC(ocr) fallback: prefers an unclaimed candidate on the row's own image
 * (the re-detected-regions case) and only then falls back to the first
 * unclaimed candidate on any image. Claiming keeps repeated OCR texts from
 * absorbing more than one correction.
 */
const resolveOcrFallback = (
  row: SheetRow,
  current: RegionLookup,
  claimed: ReadonlySet<TypographyRegion>,
): SheetOcrCandidate | null => {
  const ocrKey = nfkcKey(row.ocrText);
  if (ocrKey.length === 0) return null;
  const candidates = current.byOcr.get(ocrKey);
  if (candidates === undefined) return null;
  let crossImage: SheetOcrCandidate | null = null;
  for (const candidate of candidates) {
    if (claimed.has(candidate.region)) continue;
    if (candidate.imageId === row.imageId) return candidate;
    if (crossImage === null) crossImage = candidate;
  }
  return crossImage;
};

const isSameTranslation = (sheetTranslation: string, currentTranslation: string): boolean =>
  nfkcKey(sheetTranslation) === nfkcKey(currentTranslation);

/**
 * Applies imported rows to the current region state via the match ladder.
 * Pure: returns the corrections to write through the existing per-image
 * region update path — never touches a store itself.
 *
 * Per matched row: sheet translation equal to the current one => skipped;
 * manual-edit region diverging from the exported value => CONFLICT, skipped
 * by default (per-row opt-in through `applyConflictRowIds` — never silently
 * clobbered); any other diverging row => applied and listed in the report.
 * Rows with no ladder match => skipped as unmatched. Every match claims its
 * region, so a duplicate `(imageId, regionId)` row cannot re-apply over an
 * earlier row's outcome.
 */
export const applySheetRows = (
  rows: readonly SheetRow[],
  current: RegionLookup,
  options: SheetApplyOptions = {},
): SheetApplyResult => {
  const claimed = new Set<TypographyRegion>();
  const appliedRows: SheetAppliedRow[] = [];
  const skippedRows: SheetSkippedRow[] = [];
  const conflicts: SheetConflict[] = [];

  for (const row of rows) {
    const rowId = buildSheetRowId(row.imageId, row.regionId);
    const exact =
      current.byId.get(row.imageId)?.get(row.regionId) ?? null;
    let matched: {
      region: TypographyRegion;
      matchedImageId: string;
      matchedVia: SheetMatchStrategy;
    } | null = null;
    // A duplicate (imageId, regionId) row whose region is already claimed is
    // skipped as 'duplicate' instead of re-applying over the earlier row.
    let exactDuplicate = false;
    if (exact !== null) {
      if (claimed.has(exact)) {
        exactDuplicate = true;
      } else {
        claimed.add(exact);
        matched = { region: exact, matchedImageId: row.imageId, matchedVia: "exact" };
      }
    } else {
      const fallback = resolveOcrFallback(row, current, claimed);
      if (fallback !== null) {
        claimed.add(fallback.region);
        matched = {
          region: fallback.region,
          matchedImageId: fallback.imageId,
          matchedVia: "nfkc_ocr",
        };
      }
    }
    if (matched === null) {
      skippedRows.push({
        rowId,
        imageId: row.imageId,
        regionId: row.regionId,
        reason: exactDuplicate ? "duplicate" : "unmatched",
      });
      continue;
    }

    const currentTranslation = matched.region.translatedText ?? "";
    if (isSameTranslation(row.translation, currentTranslation)) {
      skippedRows.push({
        rowId,
        imageId: row.imageId,
        regionId: matched.region.id,
        reason: "unchanged",
      });
      continue;
    }

    const isManualEdit = matched.region.translatorModelKey === MANUAL_EDIT_KEY;
    if (isManualEdit) {
      const resolved =
        options.applyConflictRowIds?.has(rowId) === true;
      conflicts.push({
        rowId,
        imageId: row.imageId,
        regionId: matched.region.id,
        sheetTranslation: row.translation,
        currentTranslation,
        resolved,
      });
      if (!resolved) continue;
    }

    appliedRows.push({
      rowId,
      imageId: row.imageId,
      matchedImageId: matched.matchedImageId,
      rowRegionId: row.regionId,
      matchedRegionId: matched.region.id,
      matchedVia: matched.matchedVia,
      translation: row.translation,
      conflictOverride: isManualEdit,
    });
  }

  const unresolvedConflicts = conflicts.filter(
    (entry) => !entry.resolved,
  ).length;
  return {
    applied: appliedRows.length,
    skipped: skippedRows.length + unresolvedConflicts,
    appliedRows,
    skippedRows,
    conflicts,
  };
};

/**
 * Write-back grouping: corrections are applied to the image that actually
 * holds the matched region (`matchedImageId`), not to the row's declared
 * image — a stale row image id (cross-session reimport) must not silently
 * drop the correction.
 */
export const groupSheetCorrectionsByImage = (
  appliedRows: readonly SheetAppliedRow[],
): ReadonlyMap<string, readonly SheetAppliedRow[]> => {
  const byImage = new Map<string, SheetAppliedRow[]>();
  for (const row of appliedRows) {
    const group = byImage.get(row.matchedImageId);
    if (group) {
      group.push(row);
    } else {
      byImage.set(row.matchedImageId, [row]);
    }
  }
  return byImage;
};

/**
 * One image's region write: maps the corrections targeted at this image onto
 * its regions by `matchedRegionId`, stamping the manual-edit provenance on
 * every applied region. Generic over the region type so callers keep their
 * refined region models (AioTextRegion et al.). Pure — the caller routes the
 * result through the existing per-image region update path.
 */
export const applySheetCorrectionsToImageRegions = <TRegion extends TypographyRegion>(
  regions: readonly TRegion[],
  corrections: readonly SheetAppliedRow[],
): TRegion[] => {
  const correctionByRegionId = new Map<string, SheetAppliedRow>();
  for (const correction of corrections) {
    correctionByRegionId.set(correction.matchedRegionId, correction);
  }
  return regions.map((region) => {
    const correction = correctionByRegionId.get(region.id);
    if (correction === undefined) return region;
    return {
      ...region,
      translatedText: correction.translation,
      translatorModelKey: MANUAL_EDIT_KEY,
      // The sheet text replaces the engine/TM answer: the stale provenance is
      // cleared so the TM hit-count readout stays truthful.
      translationSource: null,
    };
  });
};
