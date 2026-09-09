import type {
  OptimizationPreset,
  OptimizationRecipe,
  OptimizationResult,
} from '../../../types';

export interface OptimizerImageInput {
  id: string;
  file: File;
  url: string;
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
