import type {
  OptimizationPreset,
  OptimizationRecipe,
} from '../../../types';

export const STORAGE_KEY =
  'koma-studio.chapter-optimizer.recipe.v2';

const DEFAULT_NEW_FIELDS = {
  brightness: 0,
  contrast: 0,
  noiseReduction: false,
  noiseReductionStrength: 0.5,
  rotation: 0 as const,
  renamePattern: '{name}',
};

export const PRESET_RECIPES: Record<
  OptimizationPreset,
  OptimizationRecipe
> = {
  'web-light': {
    preset: 'web-light',
    outputFormat: 'webp',
    quality: 0.78,
    resizeEnabled: true,
    maxWidth: 1600,
    maxHeight: 2400,
    trimBorders: true,
    trimTolerance: 18,
    sharpen: false,
    sharpenStrength: 0.5,
    grayscale: false,
    autoLevels: false,
    ...DEFAULT_NEW_FIELDS,
  },
  reading: {
    preset: 'reading',
    outputFormat: 'webp',
    quality: 0.9,
    resizeEnabled: true,
    maxWidth: 2200,
    maxHeight: 3200,
    trimBorders: false,
    trimTolerance: 16,
    sharpen: false,
    sharpenStrength: 0.3,
    grayscale: false,
    autoLevels: false,
    ...DEFAULT_NEW_FIELDS,
  },
  archive: {
    preset: 'archive',
    outputFormat: 'png',
    quality: 1,
    resizeEnabled: false,
    maxWidth: 2600,
    maxHeight: 3600,
    trimBorders: false,
    trimTolerance: 10,
    sharpen: false,
    sharpenStrength: 0,
    grayscale: false,
    autoLevels: false,
    ...DEFAULT_NEW_FIELDS,
  },
  social: {
    preset: 'social',
    outputFormat: 'jpeg',
    quality: 0.85,
    resizeEnabled: true,
    maxWidth: 1080,
    maxHeight: 1350,
    trimBorders: true,
    trimTolerance: 14,
    sharpen: true,
    sharpenStrength: 0.4,
    grayscale: false,
    autoLevels: true,
    ...DEFAULT_NEW_FIELDS,
    brightness: 5,
    contrast: 8,
  },
  custom: {
    preset: 'custom',
    outputFormat: 'webp',
    quality: 0.85,
    resizeEnabled: false,
    maxWidth: 2000,
    maxHeight: 3000,
    trimBorders: false,
    trimTolerance: 16,
    sharpen: false,
    sharpenStrength: 0.5,
    grayscale: false,
    autoLevels: false,
    ...DEFAULT_NEW_FIELDS,
  },
};

export type OptimizerPersistedRecipe = Omit<Partial<OptimizationRecipe>, 'preset' | 'sharpen'> & {
  preset?: OptimizationPreset | 'manga';
  sharpen?: boolean | number;
};

export const normalizeRecipe = (
  input?: OptimizerPersistedRecipe | null,
): OptimizationRecipe => {
  const preset =
    input?.preset && input.preset in PRESET_RECIPES && input.preset !== 'manga'
      ? (input.preset as OptimizationPreset)
      : 'web-light';
  const base = PRESET_RECIPES[preset];
  return {
    ...base,
    ...input,
    preset,
    sharpen: typeof input?.sharpen === 'number'
      ? input.sharpen > 0
      : input?.sharpen ?? base.sharpen,
    sharpenStrength:
      typeof input?.sharpen === 'number'
        ? input.sharpen
        : input?.sharpenStrength ?? base.sharpenStrength,
  } as OptimizationRecipe;
};
