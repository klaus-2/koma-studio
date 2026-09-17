import type { IDesktopFontEntry } from "../types";
import type { LucideIcon } from "lucide-react";
import type { FreeProviderDraftValue } from "../models/freeAiProviderCatalog";
import type { AioStageKey, AioStageSelection } from "./aioModelPresets";
import type { DetectedRenderTextMode, RenderTextMode } from "../utils/renderModes";
import type { RenderTextStyle } from "../utils/renderText";
import type {
  TypographyBounds,
  TypographyRegion,
  TypographyShape,
} from "../typography/types";
import type { RenderTextStyleRange } from "../typography/renderStyle";

export type EnhanceScale = 2 | 4;

export type EnhanceProfile = "manga_scan" | "anime_art" | "general" | "high_quality_4x";

export type ToolMode =
  | "organize"
  | "aio"
  | "cleaner"
  | "typesetter"
  | "translator"
  | "raw"
  | "proofreader"
  | "stitch"
  | "split"
  | "watermark"
  | "enhance"
  | "optimizer"
  | "blogger"
  | "imgur"
  | "guides"
  | "resources";

export type ProcessableMode = Exclude<ToolMode, "organize" | "guides" | "resources" | "blogger" | "imgur">;

export type WebhookMetricValue = string | number | boolean | null | undefined;

export type WebhookMetrics = Record<string, WebhookMetricValue>;

export type SubMode = "auto" | "manual";

export type CleanerMode = "assisted" | "automatic_ai" | "ai_sfx";

export type TranslatorWorkspaceMode = "text" | "visual";

export type TranslatorVisualProcessingMode = "standard" | "ai_sfx";

export type ViewMode = "paginated" | "long_strip";

export type SegmentEditTool = "select" | "brush" | "eraser";

export type ManualImageEditTool = "none" | "paint" | "paint_eraser" | "healing_brush" | "magic_wand";

export type AreaSelectionCreateMode = "auto" | "square" | "rounded";

export type DownloadBundleFormat = "zip" | "cbz" | "cb7" | "pdf";

export type PsdCompression = "rle" | "zip" | "raw";

export type RenderTextOverlayTarget = "raw" | "translated" | "rendered";

export type FreeProviderDraftMap = Record<string, FreeProviderDraftValue>;

export interface ImageFilters {
  brightness: number;
  contrast: number;
  saturation: number;
  sharpen: number;
  levels: { black: number; white: number; gamma: number };
  grayscale: boolean;
  inverted: boolean;
}

export interface DashboardUser {
  name: string;
  email: string;
}

export interface DashboardProcessingStatItem {
  key: "daily" | "weekly" | "monthly";
  count: number;
  resetInMs: number;
}

export interface DashboardProcessingStatsSummary {
  daily: DashboardProcessingStatItem;
  weekly: DashboardProcessingStatItem;
  monthly: DashboardProcessingStatItem;
}

export interface LoadedImage {
  id: string;
  file: File;
  url: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  width: number;
  height: number;
  rotation: number;
  filters: ImageFilters;
}

export interface DownloadItem {
  name: string;
  blob: Blob;
  scope: ProcessableMode;
  sourceImageId: string;
  previewUrl: string;
}

export interface DetectApiResponse {
  device: string;
  model_used: string;
  image_width: number;
  image_height: number;
  detections: Array<{
    id: string;
    bbox: [number, number, number, number];
    score: number;
    label: string;
    source: "model" | "manual";
    model_key: string;
    foreground_rgb?: [number, number, number] | null;
    structural_type?: string | null;
    structural_confidence?: number | null;
    structural_source?: string | null;
    matched_reference_image?: string | null;
  }>;
}

export interface OcrApiResponse {
  device: string;
  language: string;
  model_used: string;
  image_width: number;
  image_height: number;
  regions: Array<{
    id: string;
    bbox: [number, number, number, number];
    text: string;
    score: number;
    source: "model" | "manual";
    detector_model_key: string;
    ocr_model_key: string;
    foreground_gradient?: {
      start_rgb: [number, number, number];
      end_rgb: [number, number, number];
      angle_degrees: number;
    } | null;
  }>;
}

export interface TranslationApiResponse {
  source_language: string;
  target_language: string;
  model_used: string;
  regions: Array<{
    id: string;
    source_text: string;
    translated_text: string;
    translation_notes?: string[];
    source: "model" | "manual";
    detector_model_key: string;
    ocr_model_key: string;
    translator_model_key: string;
  }>;
}

export interface SegmentApiResponse {
  device: string;
  model_used: string;
  image_width: number;
  image_height: number;
  regions: Array<{
    id: string;
    bbox: [number, number, number, number];
    segment_boxes: Array<[number, number, number, number]>;
    merged_boxes: Array<[number, number, number, number]>;
    source: "model" | "manual";
    detector_model_key: string;
    ocr_model_key: string;
    translator_model_key: string;
    segment_model_key: string;
    mask_base64?: string;
  }>;
}

export interface IngestArchiveManifestEntry {
  path: string;
  source_file: string;
  original_name: string;
  mime_type: string;
}

export interface IngestArchiveManifest {
  total_input_files: number;
  total_output_images: number;
  warnings: string[];
  items: IngestArchiveManifestEntry[];
}

export interface PipelineBatchItemError {
  stage: string;
  message: string;
}

export interface PipelineBatchDetectResult {
  regions_count?: number;
  model_used?: string;
  image_width?: number;
  image_height?: number;
  detections?: Array<{
    id: string;
    bbox: [number, number, number, number];
    score: number;
    label?: string;
    source: "model" | "manual";
    model_key: string;
    foreground_rgb?: [number, number, number] | null;
    structural_type?: string | null;
    structural_confidence?: number | null;
    structural_source?: string | null;
    matched_reference_image?: string | null;
  }>;
}

export interface PipelineBatchOcrResult {
  regions_count?: number;
  model_used?: string;
  image_width?: number;
  image_height?: number;
  regions?: Array<{
    id: string;
    bbox: [number, number, number, number];
    text: string;
    score: number;
    source: "model" | "manual";
    detector_model_key: string;
    ocr_model_key: string;
    foreground_gradient?: {
      start_rgb: [number, number, number];
      end_rgb: [number, number, number];
      angle_degrees: number;
    } | null;
  }>;
}

export interface PipelineBatchTranslationResult {
  regions_count?: number;
  model_used?: string;
  source_language?: string;
  target_language?: string;
  regions?: Array<{
    id: string;
    source_text: string;
    translated_text: string;
    translation_notes?: string[];
    source: "model" | "manual";
    detector_model_key: string;
    ocr_model_key: string;
    translator_model_key: string;
  }>;
}

export interface PipelineBatchSegmentResult {
  regions_count?: number;
  model_used?: string;
  image_width?: number;
  image_height?: number;
  regions?: Array<{
    id: string;
    bbox: [number, number, number, number];
    segment_boxes: Array<[number, number, number, number]>;
    merged_boxes: Array<[number, number, number, number]>;
    source: "model" | "manual";
    detector_model_key: string;
    ocr_model_key: string;
    translator_model_key: string;
    segment_model_key: string;
  }>;
}

export interface PipelineBatchCleanResult {
  output_file?: string;
  model_used?: string;
}

export interface PipelineBatchItemResult {
  index: number;
  filename: string;
  status: "success" | "partial" | "failed";
  detect?: PipelineBatchDetectResult | null;
  ocr?: PipelineBatchOcrResult | null;
  translation?: PipelineBatchTranslationResult | null;
  segment?: PipelineBatchSegmentResult | null;
  clean?: PipelineBatchCleanResult | null;
  errors?: PipelineBatchItemError[];
}

export interface AioPresetEditorDraft {
  presetId: string | null;
  name: string;
  description: string;
  stageModels: AioStageSelection;
  setAsActive: boolean;
}

export interface TranslationNoteOverlayConfig {
  bbox: TypographyBounds;
  renderText: string;
  renderStyle?: RenderTextStyle;
  renderTextStyleRanges?: RenderTextStyleRange[];
}

export interface AioTextRegion extends TypographyRegion {
  detectedRenderMode?: DetectedRenderTextMode;
  renderMode?: RenderTextMode;
  translationNoteOverlay?: TranslationNoteOverlayConfig;
  segmentBoxes?: TypographyBounds[];
  mergedSegmentBoxes?: TypographyBounds[];
  maskBase64?: string;
  sfxCandidate?: boolean;
  sfxApproved?: boolean;
  sfxConfidence?: number | null;
  sfxRequiresRedraw?: boolean;
  sfxReason?: string | null;
}

export interface AioDownloadEntry {
  fileName: string;
  blob: Blob;
  sourceImageId: string;
}

export interface TranslatorVisualRunMeta {
  detected: boolean;
  ocr: boolean;
  translated: boolean;
  detectModelKey: string | null;
  ocrModelKey: string | null;
  translatorModelKey: string | null;
  sourceLanguage: string;
  targetLanguage: string;
  visualMode?: TranslatorVisualProcessingMode;
  sfxCandidateCount?: number;
  sfxApprovedCount?: number;
  sfxReviewCount?: number;
  cleanModelKey?: string | null;
}

export interface CleanerRunMeta {
  detected: boolean;
  ocrCount: number;
  segmentedCount: number;
  cleaned: boolean;
  detectModelKey: string | null;
  ocrModelKey: string | null;
  segmentModelKey: string | null;
  cleanModelKey: string | null;
  sourceLanguage: string;
  candidateCount?: number;
  approvedCount?: number;
  reviewCount?: number;
}

export interface AioBatchImageResult {
  imageId: string;
  detectDetections: AioTextRegion[];
  ocrDetections: AioTextRegion[];
  translationDetections: AioTextRegion[];
  segmentDetections: AioTextRegion[];
  cleanDetections: AioTextRegion[];
  renderDetections: AioTextRegion[];
  cleanedDownload: AioDownloadEntry | null;
  countAsProcessed?: boolean;
  executionNotices?: string[];
}

export interface RuntimeExecutionNotice {
  title: string;
  detail: string;
  tone?: "legacy" | "fallback" | "cpu" | "cuda";
}

export type StatusMessageTone = 'info' | 'success' | 'warning' | 'error' | 'debug';

export interface AioManualImageEditState {
  paintLayerDataUrl: string | null;
  baseImageDataUrl: string | null;
  wandMaskDataUrl: string | null;
  /** Image-scale PNG dataURL of manual segment brush strokes; used by clean image step */
  segmentBrushDataUrl: string | null;
}

export type AioPipelineSnapshotKey = AioStageKey | "render";

export type AioManualStageStatus = "locked" | "pending" | "done" | "skipped";

export interface AioManualImageProgress {
  currentIndex: number;
  unlockedMaxIndex: number;
  statusByStage: Record<AioPipelineSnapshotKey, AioManualStageStatus>;
}

export interface AioPipelineSnapshot {
  key: AioPipelineSnapshotKey;
  label: string;
  detectionsByImage: Record<string, AioTextRegion[]>;
  selectedRegionByImage: Record<string, string | null>;
  aioDownloads: AioDownloadEntry[];
}

export interface RenderFontCatalog {
  system: string[];
  custom: IDesktopFontEntry[];
}

export interface PreparedDownloadEntry {
  fileName: string;
  blob: Blob;
  sourceImageId: string;
}

export interface PsdTextLayerEntry {
  fileName: string;
  name: string;
  kind: RenderTextOverlayTarget;
  left: number;
  top: number;
  width: number;
  height: number;
  text: string;
  shape?: TypographyShape;
  stylePresetId?: string | null;
  style: RenderTextStyle & {
    wrappedText?: string;
    computedFontSize?: number;
    computedLineHeight?: number;
    computedTextHeight?: number;
    drawTopOffset?: number;
    pointAnchorX?: number;
    pointAnchorBaselineOffset?: number;
  };
  blob: Blob;
}

export interface NavItem {
  mode: ToolMode;
  icon: LucideIcon;
  label: string;
  subtitle: string;
  tooltip: string;
  hasSubMode?: boolean;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

export interface TranslatorTextRequestRegion {
  id: string;
  text: string;
  source: "manual";
  detector_model_key: string;
  ocr_model_key: string;
}

export interface TranslatorStructuredTextInput {
  regions: TranslatorTextRequestRegion[];
  reconstruct: (translatedById: Map<string, string>) => string;
}

export type RegionCorner = "nw" | "ne" | "sw" | "se";

export type OverlayInteraction =
  | {
    kind: "draw";
    pointerId: number;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  }
  | {
    kind: "move";
    pointerId: number;
    regionId: string;
    offsetX: number;
    offsetY: number;
    boxWidth: number;
    boxHeight: number;
    startPointerX: number;
    startPointerY: number;
    hasMoved: boolean;
  }
  | {
    kind: "resize";
    pointerId: number;
    regionId: string;
    corner: RegionCorner;
    anchorX: number;
    anchorY: number;
    rotation: number;
    startPointerX: number;
    startPointerY: number;
    startSkewX: number;
    startSkewY: number;
    boxWidth: number;
    boxHeight: number;
  }
  | {
    kind: "rotate";
    pointerId: number;
    regionId: string;
    centerX: number;
    centerY: number;
    startPointerAngle: number;
    startRotation: number;
  }
  | {
    kind: "segment_paint";
    pointerId: number;
    regionId: string;
    erase: boolean;
    brushSize: number;
  };

export type RenderOverlayInteraction =
  | {
    kind: "draw";
    pointerId: number;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  }
  | {
    kind: "move";
    pointerId: number;
    regionId: string;
    offsetX: number;
    offsetY: number;
    boxWidth: number;
    boxHeight: number;
    startPointerX: number;
    startPointerY: number;
    hasMoved: boolean;
    currentBox?: [number, number, number, number];
  }
  | {
    kind: "resize";
    pointerId: number;
    regionId: string;
    corner: RegionCorner;
    anchorX: number;
    anchorY: number;
    rotation: number;
    startPointerX: number;
    startPointerY: number;
    startSkewX: number;
    startSkewY: number;
    boxWidth: number;
    boxHeight: number;
  }
  | {
    kind: "rotate";
    pointerId: number;
    regionId: string;
    centerX: number;
    centerY: number;
    startPointerAngle: number;
    startRotation: number;
  }
  | {
    kind: "segment_paint";
    pointerId: number;
    regionId: string;
    erase: boolean;
    brushSize: number;
  };

export type EditableRegionTextTarget = "recognized" | "translated";

export interface DashboardPageProps {
  onOpenSettings?: () => void;
  onOpenModelRankings?: () => void;
  onOpenScanlationFeed?: () => void;
}
