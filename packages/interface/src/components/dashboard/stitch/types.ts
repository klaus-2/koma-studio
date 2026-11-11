import type { PageFile } from '../../../utils/page-source';

export type StitchLayoutMode = 'webtoon' | 'horizontal';

export type StitchBatchStrategy = 'single' | 'fixed-count' | 'target-height';

export type StitchExportFormat = 'png' | 'jpeg' | 'webp' | 'zip';

export type StitchAlignMode = 'start' | 'center' | 'end';

export interface StitchImageFilters {
  brightness: number;
  contrast: number;
  saturation: number;
  sharpen: number;
  levels: { black: number; white: number; gamma: number };
  grayscale: boolean;
  inverted: boolean;
}

export interface StitchImageInput {
  id: string;
  /**
   * The page's lazy file.
   *
   * The bytes are materialized per image at the worker-job boundary — a
   * `PageFile` carries functions, which structured clone cannot copy, so it
   * must never reach `worker.postMessage` as-is.
   */
  file: PageFile;
  url: string;
  width: number;
  height: number;
  rotation: number;
  filters: StitchImageFilters;
}

/**
 * One page, materialized for the worker.
 *
 * The worker receives plain data only: `file` is a real `File` and the
 * dimensions are the resolved pixel size (`0` would produce a zero-size
 * canvas).
 */
export interface StitchRenderImageInput {
  file: File;
  width: number;
  height: number;
  rotation: number;
  filters: StitchImageFilters;
}

export interface StitchBatchPlan {
  id: string;
  imageIndexes: number[];
  count: number;
  outputWidth: number;
  outputHeight: number;
  megapixels: number;
  estimatedBytes: number;
  warnings: string[];
}

export interface StitchRenderJob {
  requestId: string;
  images: StitchRenderImageInput[];
  layoutMode: StitchLayoutMode;
  gap: number;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  quality: number;
  background: string;
  alignMode: StitchAlignMode;
}

export interface StitchRenderResult {
  requestId: string;
  blob: Blob;
  width: number;
  height: number;
}
