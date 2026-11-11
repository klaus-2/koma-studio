import type {
  OptimizationPreset,
  OptimizationRecipe,
  OptimizationResult,
} from '../../../types';
import type { PageFile } from '../../../utils/page-source';

export interface OptimizerImageInput {
  id: string;
  /**
   * The page's lazy file.
   *
   * The bytes are materialized at each read seam — a `PageFile` is not a
   * `Blob`, so it cannot be handed to `createObjectURL`, `arrayBuffer()` or a
   * worker directly.
   */
  file: PageFile;
  url: string;
  thumbnailUrl?: string;
  width: number;
  height: number;
}

export interface OptimizerSourceVariant {
  id: string;
  imageId: string;
  label: string;
  scope: string;
  blob: Blob;
  previewUrl: string;
}

export interface OptimizerPreviewStats {
  originalBytes: number;
  optimizedBytes: number;
  width: number;
  height: number;
}

export type OptimizerRecipeUpdate = <K extends keyof OptimizationRecipe>(
  key: K,
  value: OptimizationRecipe[K],
) => void;

export interface ChapterOptimizerWorkspaceState {
  recipe: Partial<OptimizationRecipe>;
  selectedPreset: OptimizationPreset;
  activeImageId: string | null;
  results: OptimizationResult[];
}
