import { TRANSLATION_NOTE_REGION_PREFIX } from "../constants/dashboard.constants";
import type { AioDownloadEntry, AioTextRegion } from "../types/dashboard.types";
import type { RenderTextStyle } from "./renderText";
import type {
  TypographyBounds,
  TypographyDetectedGradient,
  TypographyShape,
  TypographyShapeKind,
  TypographyStylePreset,
} from "../typography/types";
import { buildShapeFromPreset } from "../typography/presets";
import { createDefaultTypographyShape } from "../typography/types";
import {
  areRenderTextStyleRangesEqual,
  cloneRenderTextStyleRanges,
} from "./renderTextStyleRanges";
import { getRenderModePresetStyle, normalizeDetectedRenderMode } from "./renderModes";

const clampNumber = (num: number, min: number, max: number): number =>
  Math.min(Math.max(num, min), max);

const ROUNDED_REFINEMENT_HORIZONTAL_MARGIN = 16;
const ROUNDED_REFINEMENT_VERTICAL_MARGIN = 60;
const ROUNDED_REFINEMENT_FIT_PROFILE = [0.50, 0.71, 0.87, 0.97, 1.0, 1.0, 0.97, 0.87, 0.71, 0.50];
const SQUARE_REFINEMENT_HORIZONTAL_MARGIN = 8;
const SQUARE_REFINEMENT_VERTICAL_MARGIN = 30;
const SQUARE_REFINEMENT_FIT_PROFILE = Array.from({ length: 10 }, () => 1);

export const areDockAnchorsEqual = (
  left: { x: number; y: number; placement: "right" | "left" | "top" | "bottom" } | null,
  right: { x: number; y: number; placement: "right" | "left" | "top" | "bottom" } | null,
): boolean => {
  if (left === right) return true;
  if (!left || !right) return false;
  return left.x === right.x && left.y === right.y && left.placement === right.placement;
};

export const normalizeTranslationNotes = (notes?: string[] | null): string[] | undefined => {
  if (!Array.isArray(notes)) return undefined;
  const normalized: string[] = [];
  for (const item of notes) {
    const value = String(item ?? "").trim();
    if (value.length > 0) normalized.push(value);
  }
  return normalized.length > 0 ? normalized : undefined;
};

export const buildDefaultRegionRenderText = (
  region: { renderText?: string | null; translatedText?: string | null; recognizedText?: string | null },
): string => (region.renderText ?? region.translatedText ?? region.recognizedText ?? "").trim();

export const getRegionTextForOverlayTarget = (
  region: { renderText?: string | null; translatedText?: string | null; recognizedText?: string | null },
  target: "raw" | "translated" | "rendered",
): string => {
  if (target === "raw") {
    return (region.recognizedText ?? "").trim();
  }
  if (target === "translated") {
    return (region.translatedText ?? "").trim();
  }
  return buildDefaultRegionRenderText(region);
};

export const buildRegionTextDump = (
  regions: Array<{
    id: string;
    bbox: [number, number, number, number];
    recognizedText?: string | null;
    translatedText?: string | null;
  }>,
  target: "recognized" | "translated",
): string => {
  const lines: string[] = [];
  const key = target === "recognized" ? "recognizedText" : "translatedText";
  const label = target === "recognized" ? "RAW_TEXT" : "TRANSLATED_TEXT";
  regions.forEach((region, index) => {
    const value = (region[key] ?? "").trim();
    if (!value) return;
    const [x1, y1, x2, y2] = region.bbox;
    lines.push(`[${label}_${index + 1}] id=${region.id} bbox=${x1},${y1},${x2},${y2}`);
    lines.push(value);
    lines.push("");
  });
  if (lines.length === 0) {
    return target === "recognized" ? "No recognized text." : "No translated text.";
  }
  return lines.join("\n").trim();
};

export const resolveSelectedRegionForRegions = (
  regions: Array<{ id: string }>,
  selectedRegionId: string | null,
): string | null => {
  if (selectedRegionId === null) return null;
  if (selectedRegionId && regions.some((region) => region.id === selectedRegionId)) return selectedRegionId;
  if (
    selectedRegionId
    && selectedRegionId.startsWith(TRANSLATION_NOTE_REGION_PREFIX)
    && regions.some((region) => region.id === selectedRegionId.slice(TRANSLATION_NOTE_REGION_PREFIX.length))
  ) {
    return selectedRegionId;
  }
  return regions[0]?.id ?? null;
};

export const getRegionTranslationNotesForDisplay = (
  region: {
    id?: string;
    translationNoteOverlay?: { renderText?: string | null } | null;
    translationNotes?: string[] | null;
  },
  notesEnabled: boolean,
): string[] => {
  if (!notesEnabled) return [];
  if (region.translationNoteOverlay?.renderText?.trim()) {
    return region.translationNoteOverlay.renderText
      .split("\n")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return normalizeTranslationNotes(region.translationNotes) ?? [];
};

export const isTranslationNoteOverlayRegion = (region: { id: string }): boolean =>
  region.id.startsWith(TRANSLATION_NOTE_REGION_PREFIX);

export const buildRegionNotesDump = (
  regions: Array<{
    id: string;
    bbox: [number, number, number, number];
    translationNoteOverlay?: { renderText?: string | null } | null;
    translationNotes?: string[] | null;
  }>,
): string => {
  const lines: string[] = [];
  let noteIndex = 0;
  regions.forEach((region) => {
    const notes = getRegionTranslationNotesForDisplay(region, true);
    if (!notes || notes.length === 0) return;
    noteIndex += 1;
    const [x1, y1, x2, y2] = region.bbox;
    lines.push(`[NT_${noteIndex}] id=${region.id} bbox=${x1},${y1},${x2},${y2}`);
    notes.forEach((note) => lines.push(note));
    lines.push("");
  });
  return lines.join("\n").trim();
};



export const normalizeRegion = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  height: number,
): [number, number, number, number] => {
  const left = clampNumber(Math.min(x1, x2), 0, width);
  const right = clampNumber(Math.max(x1, x2), 0, width);
  const top = clampNumber(Math.min(y1, y2), 0, height);
  const bottom = clampNumber(Math.max(y1, y2), 0, height);
  return [left, top, right, bottom];
};

export const toApiIntegerBbox = (
  bbox: [number, number, number, number],
  width: number,
  height: number,
): [number, number, number, number] => {
  const maxWidth = Math.max(1, Math.round(width));
  const maxHeight = Math.max(1, Math.round(height));
  const left = clampNumber(Math.floor(Math.min(bbox[0], bbox[2])), 0, maxWidth - 1);
  const top = clampNumber(Math.floor(Math.min(bbox[1], bbox[3])), 0, maxHeight - 1);
  const right = clampNumber(Math.ceil(Math.max(bbox[0], bbox[2])), left + 1, maxWidth);
  const bottom = clampNumber(Math.ceil(Math.max(bbox[1], bbox[3])), top + 1, maxHeight);
  return [left, top, right, bottom];
};

export const cloneTypographyShape = (shape?: TypographyShape): TypographyShape | undefined => (
  shape
    ? {
      ...shape,
      innerBox: [...shape.innerBox] as TypographyBounds,
      fitProfile: [...shape.fitProfile],
      maskPolygon: shape.maskPolygon?.map((point) => [...point] as [number, number]),
    }
    : undefined
);

export const scaleTypographyShapeForBounds = (
  shape: TypographyShape | undefined,
  sourceBounds: TypographyBounds,
  targetBounds: TypographyBounds,
): TypographyShape | undefined => {
  if (!shape) return undefined;
  const sourceWidth = Math.max(1, sourceBounds[2] - sourceBounds[0]);
  const sourceHeight = Math.max(1, sourceBounds[3] - sourceBounds[1]);
  const targetWidth = Math.max(1, targetBounds[2] - targetBounds[0]);
  const targetHeight = Math.max(1, targetBounds[3] - targetBounds[1]);
  const scaleX = targetWidth / sourceWidth;
  const scaleY = targetHeight / sourceHeight;
  return {
    ...shape,
    cornerRadius: Math.round(shape.cornerRadius * Math.min(scaleX, scaleY)),
    innerBox: [
      Math.round(shape.innerBox[0] * scaleX),
      Math.round(shape.innerBox[1] * scaleY),
      Math.round(shape.innerBox[2] * scaleX),
      Math.round(shape.innerBox[3] * scaleY),
    ],
    maskPolygon: shape.maskPolygon?.map((point) => [
      Math.round(point[0] * scaleX),
      Math.round(point[1] * scaleY),
    ] as [number, number]),
    fitProfile: [...shape.fitProfile],
  };
};

export const areBoxArraysEqual = (
  left?: TypographyBounds[] | null,
  right?: TypographyBounds[] | null,
): boolean => {
  if (left === right) return true;
  if (!left || !right) return left === right;
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    const a = left[i]!;
    const b = right[i]!;
    if (a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2] || a[3] !== b[3]) return false;
  }
  return true;
};



export const cloneAioDownloadEntries = (entries: AioDownloadEntry[]): AioDownloadEntry[] =>
  entries.map((entry) => ({
    fileName: entry.fileName,
    blob: entry.blob,
    sourceImageId: entry.sourceImageId,
  }));

export const ensureRegionShape = (
  region: AioTextRegion,
  fallbackPreset?: TypographyStylePreset | null,
): TypographyShape => {
  const [x1, y1, x2, y2] = region.bbox;
  const width = Math.max(1, x2 - x1);
  const height = Math.max(1, y2 - y1);
  if (region.shape && (region.shape.source === "refined" || region.shape.source === "converted")) {
    return cloneTypographyShape(region.shape)!;
  }
  const detectedRenderMode = normalizeDetectedRenderMode(region.detectedRenderMode) ?? "text_bubble";
  const autoShapeKind: TypographyShapeKind =
    detectedRenderMode === "text_bubble" || detectedRenderMode === "text_inside_black_bubble"
      ? "rounded"
      : "square";
  if (!fallbackPreset) {
    return autoShapeKind === "rounded"
      ? createRoundedRefinementShape(width, height, "refined")
      : createSquareRefinementShape(width, height, "refined");
  }
  return buildShapeFromPreset(fallbackPreset ?? null, width, height);
};







export const resolveRegionShapeKind = (
  region: Pick<AioTextRegion, "bbox" | "shape">,
): TypographyShapeKind => region.shape?.kind ?? "rounded";

export const rebuildRegionShapeForKind = (
  region: AioTextRegion,
  kind: TypographyShapeKind,
  source: TypographyShape["source"] = "converted",
): AioTextRegion => {
  const [x1, y1, x2, y2] = region.bbox;
  const width = Math.max(1, x2 - x1);
  const height = Math.max(1, y2 - y1);
  return {
    ...region,
    shape: createDefaultTypographyShape(width, height, kind, source),
  };
};

const clampRefinementMargin = (size: number, margin: number): number =>
  Math.min(margin, Math.max(0, Math.floor((Math.max(1, Math.round(size)) - 1) / 2)));

const createRoundedRefinementShape = (
  width: number,
  height: number,
  source: TypographyShape["source"] = "refined",
): TypographyShape => {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const horizontalMargin = clampRefinementMargin(
    safeWidth,
    Math.min(
      ROUNDED_REFINEMENT_HORIZONTAL_MARGIN,
      Math.round(safeWidth * 0.05),
    ),
  );
  const verticalMargin = clampRefinementMargin(
    safeHeight,
    Math.min(
      ROUNDED_REFINEMENT_VERTICAL_MARGIN,
      Math.round(safeHeight * 0.20),
    ),
  );

  return {
    kind: "rounded",
    source,
    cornerRadius: Math.round(Math.min(safeWidth, safeHeight) * 0.18),
    innerBox: [
      horizontalMargin,
      verticalMargin,
      Math.max(horizontalMargin + 1, safeWidth - horizontalMargin),
      Math.max(verticalMargin + 1, safeHeight - verticalMargin),
    ],
    fitProfile: [...ROUNDED_REFINEMENT_FIT_PROFILE],
  };
};

const createSquareRefinementShape = (
  width: number,
  height: number,
  source: TypographyShape["source"] = "refined",
): TypographyShape => {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const horizontalMargin = clampRefinementMargin(
    safeWidth,
    Math.min(
      SQUARE_REFINEMENT_HORIZONTAL_MARGIN,
      Math.round(safeWidth * 0.04),
    ),
  );
  const verticalMargin = clampRefinementMargin(
    safeHeight,
    Math.min(
      SQUARE_REFINEMENT_VERTICAL_MARGIN,
      Math.round(safeHeight * 0.12),
    ),
  );

  return {
    kind: "square",
    source,
    cornerRadius: 0,
    innerBox: [
      horizontalMargin,
      verticalMargin,
      Math.max(horizontalMargin + 1, safeWidth - horizontalMargin),
      Math.max(verticalMargin + 1, safeHeight - verticalMargin),
    ],
    fitProfile: [...SQUARE_REFINEMENT_FIT_PROFILE],
  };
};

export const rebuildRegionShapeForRefinement = (
  region: AioTextRegion,
  kind: TypographyShapeKind,
  source: TypographyShape["source"] = "refined",
): AioTextRegion => {
  const [x1, y1, x2, y2] = region.bbox;
  const width = Math.max(1, x2 - x1);
  const height = Math.max(1, y2 - y1);

  return {
    ...region,
    shape:
      kind === "rounded"
        ? createRoundedRefinementShape(width, height, source)
        : createSquareRefinementShape(width, height, source),
  };
};

export const rebuildRegionShapeForAutoMode = (
  region: AioTextRegion,
  source: TypographyShape["source"] = "detected",
): AioTextRegion => {
  const detectedRenderMode = normalizeDetectedRenderMode(region.detectedRenderMode) ?? "text_bubble";
  const autoShapeKind: TypographyShapeKind =
    detectedRenderMode === "text_bubble" || detectedRenderMode === "text_inside_black_bubble"
      ? "rounded"
      : "square";
  return rebuildRegionShapeForRefinement(region, autoShapeKind, source === "detected" ? "refined" : source);
};

export const cloneAioRegion = (
  region: AioTextRegion,
  cloneStyle: (style?: RenderTextStyle) => RenderTextStyle,
): AioTextRegion => ({
  ...region,
  bbox: [...region.bbox] as [number, number, number, number],
  detectedForegroundRgb: region.detectedForegroundRgb
    ? [...region.detectedForegroundRgb] as [number, number, number]
    : undefined,
  detectedGradient: region.detectedGradient
    ? {
      startRgb: [...region.detectedGradient.startRgb] as [number, number, number],
      endRgb: [...region.detectedGradient.endRgb] as [number, number, number],
      angle: region.detectedGradient.angle,
    }
    : undefined,
  structuralType: region.structuralType,
  structuralConfidence: region.structuralConfidence,
  structuralSource: region.structuralSource,
  matchedReferenceImage: region.matchedReferenceImage,
  translationNotes: region.translationNotes ? [...region.translationNotes] : undefined,
  translationNoteOverlay: region.translationNoteOverlay
    ? {
      bbox: [...region.translationNoteOverlay.bbox] as [number, number, number, number],
      renderText: region.translationNoteOverlay.renderText,
      renderStyle: region.translationNoteOverlay.renderStyle
        ? cloneStyle(region.translationNoteOverlay.renderStyle)
        : undefined,
      renderTextStyleRanges: cloneRenderTextStyleRanges(
        region.translationNoteOverlay.renderTextStyleRanges,
      ),
    }
    : undefined,
  segmentBoxes: region.segmentBoxes?.map((box) => [...box] as [number, number, number, number]),
  mergedSegmentBoxes: region.mergedSegmentBoxes?.map((box) => [...box] as [number, number, number, number]),
  renderStyle: region.renderStyle ? cloneStyle(region.renderStyle) : undefined,
  renderTextStyleRanges: cloneRenderTextStyleRanges(region.renderTextStyleRanges),
  stylePresetId: region.stylePresetId ?? null,
  queueIndex: region.queueIndex ?? null,
  locked: Boolean(region.locked),
  hidden: Boolean(region.hidden),
  notes: region.notes ? [...region.notes] : undefined,
  shape: cloneTypographyShape(region.shape),
});

export const cloneAioRegions = (
  regions: AioTextRegion[],
  cloneStyle: (style?: RenderTextStyle) => RenderTextStyle,
): AioTextRegion[] => regions.map((region) => cloneAioRegion(region, cloneStyle));

/**
 * Clone-on-write region update: regions whose content matches the previous
 * committed state keep their object identity, so downstream identity caches
 * (region model, canvas layout cache, memoized overlay boxes) stay warm and
 * the store churn per edit stays proportional to what actually changed.
 * The wholesale deep clone this replaces was the dominant cost of every
 * region commit (drag release, text edits) on region-heavy pages.
 */
export const cloneAioRegionsCoW = (
  nextRegions: AioTextRegion[],
  previousRegions: AioTextRegion[] | undefined,
  cloneStyle: (style?: RenderTextStyle) => RenderTextStyle,
): { regions: AioTextRegion[]; changed: boolean } => {
  let changed = (previousRegions?.length ?? -1) !== nextRegions.length;
  const regions = nextRegions.map((region, index) => {
    const previous = previousRegions?.[index];
    if (previous === region) return region;
    const cloned = cloneAioRegion(region, cloneStyle);
    if (previous && areAioRegionsEqual([previous], [cloned], cloneStyle)) {
      return previous;
    }
    changed = true;
    return cloned;
  });
  return { regions, changed };
};

const areRgbTripletsEqual = (
  a: [number, number, number] | undefined,
  b: [number, number, number] | undefined,
): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
};

const areGradientsEqual = (
  a: TypographyDetectedGradient | undefined,
  b: TypographyDetectedGradient | undefined,
): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.angle === b.angle &&
    areRgbTripletsEqual(a.startRgb, b.startRgb) &&
    areRgbTripletsEqual(a.endRgb, b.endRgb)
  );
};

const areStringArraysEqual = (
  a: string[] | undefined,
  b: string[] | undefined,
): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const areBboxesEqual = (
  a: [number, number, number, number] | null,
  b: [number, number, number, number] | null,
): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
};

const areShapesEqual = (
  a: TypographyShape | undefined,
  b: TypographyShape | undefined,
): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.kind === b.kind &&
    a.source === b.source &&
    a.cornerRadius === b.cornerRadius &&
    areBboxesEqual(a.innerBox, b.innerBox) &&
    a.confidence === b.confidence &&
    areNumberArraysEqual(a.fitProfile, b.fitProfile) &&
    arePolygonPointsEqual(a.maskPolygon, b.maskPolygon)
  );
};

const areNumberArraysEqual = (a: number[] | undefined, b: number[] | undefined): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const arePolygonPointsEqual = (
  a: Array<[number, number]> | undefined,
  b: Array<[number, number]> | undefined,
): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const leftPoint = a[i]!;
    const rightPoint = b[i]!;
    if (leftPoint[0] !== rightPoint[0] || leftPoint[1] !== rightPoint[1]) return false;
  }
  return true;
};

export const areRenderStylesEqual = (
  left: RenderTextStyle | undefined,
  right: RenderTextStyle | undefined,
  cloneStyle: (style?: RenderTextStyle) => RenderTextStyle,
): boolean => {
  if (left === right) return true;
  const a = cloneStyle(left);
  const b = cloneStyle(right);
  return JSON.stringify(a) === JSON.stringify(b);
};

export const areAioRegionsEqual = (
  left: AioTextRegion[],
  right: AioTextRegion[],
  cloneStyle: (style?: RenderTextStyle) => RenderTextStyle,
): boolean => {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index]!;
    const b = right[index]!;
    if (a.id !== b.id) return false;
    if (a.source !== b.source) return false;
    if (a.score !== b.score) return false;
    if (a.modelKey !== b.modelKey) return false;
    if (a.detectorModelKey !== b.detectorModelKey) return false;
    if (!areRgbTripletsEqual(a.detectedForegroundRgb, b.detectedForegroundRgb)) return false;
    if (!areGradientsEqual(a.detectedGradient, b.detectedGradient)) return false;
    if (a.structuralType !== b.structuralType) return false;
    if (a.structuralConfidence !== b.structuralConfidence) return false;
    if (a.structuralSource !== b.structuralSource) return false;
    if (a.matchedReferenceImage !== b.matchedReferenceImage) return false;
    if (a.recognizedText !== b.recognizedText) return false;
    if (a.ocrScore !== b.ocrScore) return false;
    if (a.ocrModelKey !== b.ocrModelKey) return false;
    if (a.translatedText !== b.translatedText) return false;
    if (!areStringArraysEqual(a.translationNotes, b.translationNotes)) return false;
    if (!areBboxesEqual(a.translationNoteOverlay?.bbox ?? null, b.translationNoteOverlay?.bbox ?? null)) return false;
    if ((a.translationNoteOverlay?.renderText ?? null) !== (b.translationNoteOverlay?.renderText ?? null)) return false;
    if (
      !areRenderStylesEqual(
        a.translationNoteOverlay?.renderStyle,
        b.translationNoteOverlay?.renderStyle,
        cloneStyle,
      )
    ) {
      return false;
    }
    if (
      !areRenderTextStyleRangesEqual(
        a.translationNoteOverlay?.renderTextStyleRanges,
        b.translationNoteOverlay?.renderTextStyleRanges,
      )
    ) {
      return false;
    }
    if (a.translatorModelKey !== b.translatorModelKey) return false;
    if (a.segmentModelKey !== b.segmentModelKey) return false;
    if (a.detectedRenderMode !== b.detectedRenderMode) return false;
    if (a.renderMode !== b.renderMode) return false;
    if (a.renderText !== b.renderText) return false;
    if (!areRenderTextStyleRangesEqual(a.renderTextStyleRanges, b.renderTextStyleRanges)) return false;
    if (a.stylePresetId !== b.stylePresetId) return false;
    if ((a.queueIndex ?? null) !== (b.queueIndex ?? null)) return false;
    if (Boolean(a.locked) !== Boolean(b.locked)) return false;
    if (Boolean(a.hidden) !== Boolean(b.hidden)) return false;
    if (!areStringArraysEqual(a.notes, b.notes)) return false;
    if (!areShapesEqual(a.shape, b.shape)) return false;
    if (
      a.bbox[0] !== b.bbox[0]
      || a.bbox[1] !== b.bbox[1]
      || a.bbox[2] !== b.bbox[2]
      || a.bbox[3] !== b.bbox[3]
    ) {
      return false;
    }
    if (!areBoxArraysEqual(a.segmentBoxes, b.segmentBoxes)) return false;
    if (!areBoxArraysEqual(a.mergedSegmentBoxes, b.mergedSegmentBoxes)) return false;
    if (!areRenderStylesEqual(a.renderStyle, b.renderStyle, cloneStyle)) return false;
  }
  return true;
};

export const cloneAioDetectionsMap = (
  detectionsByImage: Record<string, AioTextRegion[]>,
  cloneStyle: (style?: RenderTextStyle) => RenderTextStyle,
): Record<string, AioTextRegion[]> => {
  const next: Record<string, AioTextRegion[]> = {};
  Object.entries(detectionsByImage).forEach(([imageId, regions]) => {
    next[imageId] = cloneAioRegions(regions, cloneStyle);
  });
  return next;
};

export const buildAioSelectionMapFromDetections = (
  detectionsByImage: Record<string, AioTextRegion[]>,
): Record<string, string | null> => {
  const next: Record<string, string | null> = {};
  Object.entries(detectionsByImage).forEach(([imageId, regions]) => {
    next[imageId] = regions[0]?.id ?? null;
  });
  return next;
};

export const applyRenderDefaultsToRegion = (
  region: AioTextRegion,
  fallbackStyle: RenderTextStyle,
  applyDetectedGradient: (region: AioTextRegion, style: RenderTextStyle) => RenderTextStyle,
  fallbackPreset?: TypographyStylePreset | null,
  targetLanguage?: string | null,
): AioTextRegion => {
  const normalizedTargetLanguage = String(targetLanguage ?? "").trim().toLowerCase();
  const resolvedStyle = {
    ...getRenderModePresetStyle(
      region.renderMode ?? "auto",
      fallbackStyle,
      region.detectedRenderMode ?? "text_bubble",
    ),
    ...region.renderStyle,
    hyphenationEnabled: region.renderStyle?.hyphenationEnabled ?? false,
    hyphenationLanguage: normalizedTargetLanguage || undefined,
  };
  return {
    ...region,
    detectedRenderMode: region.detectedRenderMode ?? "text_bubble",
    renderMode: region.renderMode ?? "auto",
    renderText: buildDefaultRegionRenderText(region),
    renderStyle: applyDetectedGradient(region, resolvedStyle),
    shape: ensureRegionShape(region, fallbackPreset),
    locked: Boolean(region.locked),
    hidden: Boolean(region.hidden),
    queueIndex: region.queueIndex ?? null,
    stylePresetId: region.stylePresetId ?? null,
    notes: region.notes ? [...region.notes] : undefined,
  };
};
