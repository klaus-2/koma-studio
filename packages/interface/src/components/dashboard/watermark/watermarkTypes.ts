export type WatermarkPlacementMode = 'single' | 'tile' | 'grid' | 'smart' | 'multi';
export type WatermarkAnchor =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export type WatermarkBlendMode =
  | 'source-over'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'soft-light'
  | 'hard-light'
  | 'color-dodge'
  | 'color-burn';

export interface WatermarkTextStyle {
  enabled: boolean;
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  opacity: number;
  outlineWidth: number;
  outlineColor: string;
  shadowBlur: number;
  shadowColor: string;
  shadowOpacity: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
}

export interface WatermarkImageStyle {
  enabled: boolean;
  opacity: number;
  scalePercent: number;
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
}

export interface WatermarkTextAvoidanceZone {
  id: string;
  bbox: [number, number, number, number]; // [x1, y1, x2, y2] in image space
  score: number;
  label: string;
}

export interface WatermarkDraft {
  placementMode: WatermarkPlacementMode;
  anchor: WatermarkAnchor;
  density: number;
  gapX: number;
  gapY: number;
  rotation: number;
  padding: number;
  offsetX: number;
  offsetY: number;
  blendMode: WatermarkBlendMode;
  baseName: string;
  avoidTextRegions: boolean;
  multiAnchors: WatermarkAnchor[];
  textLayer: WatermarkTextStyle;
  imageLayer: WatermarkImageStyle;
  shadowLayer: WatermarkShadowStyle;
}

export interface WatermarkShadowStyle {
  enabled: boolean;
  blur: number;
  color: string;
  opacity: number;
  offsetX: number;
  offsetY: number;
}

export interface WatermarkPresetV1 {
  id: string;
  kind: 'builtin' | 'user';
  name: string;
  createdAt: string;
  updatedAt: string;
  settings: WatermarkDraft;
}

export interface WatermarkImageFilters {
  brightness: number;
  contrast: number;
  saturation: number;
  sharpen: number;
  levels: {
    black: number;
    white: number;
    gamma: number;
  };
  grayscale: boolean;
  inverted: boolean;
}

export interface WatermarkLoadedImage {
  id: string;
  file: File;
  url: string;
  width: number;
  height: number;
  rotation: number;
  filters: WatermarkImageFilters;
}

export interface WatermarkRenderAsset {
  sourceFile: Blob;
  watermarkFile?: Blob | null;
  image: Pick<WatermarkLoadedImage, 'id' | 'width' | 'height' | 'rotation' | 'filters'>;
  outputType: string;
  outputQuality: number;
  settings: WatermarkDraft;
  textAvoidanceZones?: WatermarkTextAvoidanceZone[];
}

export interface WatermarkRenderResult {
  blob: Blob;
  width: number;
  height: number;
  resolvedAnchor: WatermarkAnchor;
}

export interface WatermarkSmartSuggestion {
  anchor: WatermarkAnchor;
  textColor: string;
  reason: string;
}

export interface WatermarkResultEntry {
  sourceImageId: string;
  name: string;
  blob: Blob;
  previewUrl: string;
  resolvedAnchor: WatermarkAnchor;
}

export interface WatermarkWorkspaceState {
  draft: WatermarkDraft;
  activeImageId: string | null;
  compareMode: "split" | "preview";
  compareValue: number;
  selectedPresetId: string;
  autoSuggestion: string;
  userPresets: WatermarkPresetV1[];
  watermarkImageFile: File | null;
  results: WatermarkResultEntry[];
  textZoneCache: Record<string, WatermarkTextAvoidanceZone[]>;
}
