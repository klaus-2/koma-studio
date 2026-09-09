import type {
  RenderTextStyle,
  RenderTextStyleRange,
} from "./renderStyle";
import { cloneRenderTextStyleRanges } from "../utils/renderTextStyleRanges";

export type TypographyBounds = [number, number, number, number];
export type TypographyPoint = [number, number];
export type TypographyShapeKind = "square" | "rounded";
export type TypographyShapeSource = "manual" | "detected" | "refined" | "converted" | "legacy";
export type TypographyRegionSource = "model" | "manual";
export type TypographyQueueStatus = "pending" | "applied" | "skipped";
export type TypographySessionSourceType = "uploaded-cleaned" | "aio-handoff" | "generic-upload";

export interface TypographyDetectedGradient {
  startRgb: [number, number, number];
  endRgb: [number, number, number];
  angle: number;
}

export interface TypographyShape {
  kind: TypographyShapeKind;
  source: TypographyShapeSource;
  cornerRadius: number;
  innerBox: TypographyBounds;
  fitProfile: number[];
  confidence?: number;
  maskPolygon?: TypographyPoint[];
}

export interface TranslationNoteOverlayConfig {
  bbox: TypographyBounds;
  renderText: string;
  renderStyle?: RenderTextStyle;
  renderTextStyleRanges?: RenderTextStyleRange[];
}

export interface TypographyRegion {
  id: string;
  bbox: TypographyBounds;
  score: number;
  source: TypographyRegionSource;
  modelKey: string;
  detectorModelKey?: string;
  detectedForegroundRgb?: [number, number, number];
  detectedGradient?: TypographyDetectedGradient;
  structuralType?: string;
  structuralConfidence?: number;
  structuralSource?: string;
  matchedReferenceImage?: string;
  detectedRenderMode?: string;
  renderMode?: string;
  recognizedText?: string;
  ocrScore?: number;
  ocrModelKey?: string;
  translatedText?: string;
  translationNotes?: string[];
  translationNoteOverlay?: TranslationNoteOverlayConfig;
  translatorModelKey?: string;
  segmentBoxes?: TypographyBounds[];
  mergedSegmentBoxes?: TypographyBounds[];
  segmentModelKey?: string;
  renderText?: string;
  renderStyle?: RenderTextStyle;
  renderTextStyleRanges?: RenderTextStyleRange[];
  stylePresetId?: string | null;
  queueIndex?: number | null;
  locked?: boolean;
  hidden?: boolean;
  notes?: string[];
  shape?: TypographyShape;
}

export interface TextQueueItem {
  id: string;
  text: string;
  status: TypographyQueueStatus;
  appliedRegionId?: string | null;
  createdAt: number;
}

export interface TypographyStyleFolder {
  id: string;
  name: string;
  parentId: string | null;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface TypographyStylePreset {
  id: string;
  folderId: string | null;
  name: string;
  description: string;
  style: RenderTextStyle;
  defaultShapeKind: TypographyShapeKind;
  padding: number;
  createdAt: number;
  updatedAt: number;
}

export interface TypographyPresetStateV1 {
  version: 1;
  folders: TypographyStyleFolder[];
  presets: TypographyStylePreset[];
  modeBindings: Record<string, string>;
  defaultPresetId: string | null;
}

export interface TypographyShortcutConfigV1 {
  version: 1;
  shortcuts: Record<string, string[]>;
}

export interface TypographerSnapshot {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  selectedRegionId: string | null;
  activePresetId: string | null;
  queue: TextQueueItem[];
  draftText: string;
  multiBubbleEnabled: boolean;
  defaults: {
    padding: number;
    defaultShapeKind: TypographyShapeKind;
    autoDetectOnNewSelection: boolean;
  };
  regions: TypographyRegion[];
}

export interface TypographySession {
  imageId: string;
  imageFingerprint: string;
  sourceType: TypographySessionSourceType;
  activePresetId: string | null;
  selectedRegionId: string | null;
  queue: TextQueueItem[];
  draftText: string;
  multiBubbleEnabled: boolean;
  defaults: {
    padding: number;
    defaultShapeKind: TypographyShapeKind;
    autoDetectOnNewSelection: boolean;
  };
  snapshots: TypographerSnapshot[];
  updatedAt: number;
}

export const createTypographyId = (prefix: string): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const createDefaultTypographyShape = (
  width: number,
  height: number,
  kind: TypographyShapeKind = "square",
  source: TypographyShapeSource = "manual",
): TypographyShape => {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const padding = Math.max(6, Math.round(Math.min(safeWidth, safeHeight) * 0.08));
  const roundedProfile = [0.72, 0.84, 0.93, 0.98, 1, 1, 0.98, 0.93, 0.84, 0.72];
  return {
    kind,
    source,
    cornerRadius: kind === "rounded" ? Math.round(Math.min(safeWidth, safeHeight) * 0.18) : 0,
    innerBox: [
      padding,
      padding,
      Math.max(padding + 1, safeWidth - padding),
      Math.max(padding + 1, safeHeight - padding),
    ],
    fitProfile: kind === "rounded" ? roundedProfile : roundedProfile.map(() => 1),
  };
};

export const cloneTypographyShape = (shape?: TypographyShape | null): TypographyShape | undefined => {
  if (!shape) return undefined;
  return {
    ...shape,
    innerBox: [...shape.innerBox] as TypographyBounds,
    fitProfile: [...shape.fitProfile],
    maskPolygon: shape.maskPolygon?.map((point) => [...point] as TypographyPoint),
  };
};

export const cloneTypographyRegion = (region: TypographyRegion): TypographyRegion => ({
  ...region,
  bbox: [...region.bbox] as TypographyBounds,
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
  translationNotes: region.translationNotes ? [...region.translationNotes] : undefined,
  translationNoteOverlay: region.translationNoteOverlay
    ? {
      bbox: [...region.translationNoteOverlay.bbox] as TypographyBounds,
      renderText: region.translationNoteOverlay.renderText,
      renderStyle: region.translationNoteOverlay.renderStyle
        ? { ...region.translationNoteOverlay.renderStyle }
        : undefined,
      renderTextStyleRanges: cloneRenderTextStyleRanges(
        region.translationNoteOverlay.renderTextStyleRanges,
      ),
    }
    : undefined,
  segmentBoxes: region.segmentBoxes?.map((box) => [...box] as TypographyBounds),
  mergedSegmentBoxes: region.mergedSegmentBoxes?.map((box) => [...box] as TypographyBounds),
  renderStyle: region.renderStyle ? { ...region.renderStyle } : undefined,
  renderTextStyleRanges: cloneRenderTextStyleRanges(region.renderTextStyleRanges),
  notes: region.notes ? [...region.notes] : undefined,
  shape: cloneTypographyShape(region.shape),
});

export const cloneTypographyRegions = (regions: TypographyRegion[]): TypographyRegion[] =>
  regions.map((region) => cloneTypographyRegion(region));
