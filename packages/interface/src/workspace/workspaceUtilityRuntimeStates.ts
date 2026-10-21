import type { OptimizationResult } from "../types";

/**
 * Runtime (non-document) shapes of the special-tool workspace states — the
 * leaf type home for the workspace tool codecs. Declared here (instead of the
 * dashboardWorkspace barrel) so colocated codec modules can type their
 * toDocument/toRuntime pairs without importing the barrel (which re-exports
 * the serialization implementation).
 */

export interface WatermarkWorkspaceRuntimeState {
  draft: unknown;
  activeImageId: string | null;
  compareMode: "split" | "preview";
  compareValue: number;
  selectedPresetId: string;
  autoSuggestion: string;
  userPresets: unknown[];
  watermarkImageFile: File | null;
  results: Array<{
    sourceImageId: string;
    name: string;
    blob: Blob;
    previewUrl: string;
    resolvedAnchor: string;
  }>;
  textZoneCache?: Record<string, Array<{ id: string; bbox: [number, number, number, number]; score: number; label: string }>>;
}

export interface OptimizerWorkspaceRuntimeState {
  recipe: unknown;
  selectedPreset: string;
  activeImageId: string | null;
  results: OptimizationResult[];
}

export interface SplitterWorkspaceRuntimeState {
  recipe: unknown;
  imageStates: Record<string, unknown>;
  activeImageId: string | null;
}
