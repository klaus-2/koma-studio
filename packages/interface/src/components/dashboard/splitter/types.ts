export type SplitStrategy = 'count' | 'fixed_height' | 'smart' | 'advanced_desktop' | 'manual';

export type SplitAxis = 'vertical' | 'horizontal';

export type SplitPresetKey = 'webtoon_clean' | 'webtoon_dense' | 'mixed' | 'manual_first';

export type SplitExportFormat = 'png' | 'jpeg' | 'webp';

export interface SplitterImageFilters {
  brightness: number;
  contrast: number;
  saturation: number;
  sharpen: number;
  levels: { black: number; white: number; gamma: number };
  grayscale: boolean;
  inverted: boolean;
}

export interface SplitterImageInput {
  id: string;
  file: File;
  url: string;
  width: number;
  height: number;
  rotation: number;
  filters: SplitterImageFilters;
}

export interface SplitterRecipe {
  strategy: SplitStrategy;
  axis: SplitAxis;
  parts: number;
  fixedHeight: number;
  minSegmentSize: number;
  maxSegmentSize: number;
  overlap: number;
  whitespaceSensitivity: number;
  noiseReduction: number;
  edgeGuard: number;
  protectTallBlocks: boolean;
  preset: SplitPresetKey;
  outputFormat: SplitExportFormat;
  baseName: string;
  suffixPattern: string;
}

export interface SplitterCutLine {
  id: string;
  position: number;
  locked: boolean;
  score: number;
  source: 'auto' | 'manual' | 'advanced_desktop';
  warning?: string | null;
}

export interface SplitterSegmentPreview {
  id: string;
  start: number;
  end: number;
  size: number;
  warning?: string | null;
}

export interface SplitterDiagnostics {
  averageBrightness: number;
  whitespaceCandidates: number;
  engine: 'worker' | 'advanced_desktop';
}

export interface SplitterAnalysisResult {
  imageId: string;
  width: number;
  height: number;
  strategy: SplitStrategy;
  cuts: SplitterCutLine[];
  segments: SplitterSegmentPreview[];
  warnings: string[];
  diagnostics: SplitterDiagnostics;
}

export interface SplitterImageState {
  imageId: string;
  recipeOverride?: Partial<SplitterRecipe>;
  analysis?: SplitterAnalysisResult | null;
  status?: 'idle' | 'analyzing' | 'ready' | 'error';
  error?: string | null;
}

export interface SplitterWorkspaceState {
  recipe: SplitterRecipe;
  imageStates: Record<string, SplitterImageState>;
  activeImageId: string | null;
}

export interface SplitterExportEntry {
  fileName: string;
  blob: Blob;
  sourceImageId: string;
}

export interface SplitterAnalyzeRequest {
  imageId: string;
  file: File | Blob;
  width: number;
  height: number;
  recipe: SplitterRecipe;
}
