import {
  applyImageFiltersToContext,
  getExtensionFromMimeType,
  getMimeTypeFromExportFormat,
  getRotatedDimensions,
  sanitizeFileStem,
} from '../stitch/stitchUtils';
import type {
  SplitterAnalysisResult,
  SplitterAnalyzeRequest,
  SplitterCutLine,
  SplitterExportEntry,
  SplitterImageInput,
  SplitterImageState,
  SplitterRecipe,
  SplitterSegmentPreview,
  SplitPresetKey,
  SplitStrategy,
} from './types';

type Canvas2DLike = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const buildId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const createDefaultSplitterRecipe = (): SplitterRecipe => ({
  strategy: 'smart',
  axis: 'vertical',
  parts: 3,
  fixedHeight: 1600,
  minSegmentSize: 900,
  maxSegmentSize: 2800,
  overlap: 28,
  whitespaceSensitivity: 62,
  noiseReduction: 24,
  edgeGuard: 42,
  protectTallBlocks: true,
  preset: 'webtoon_clean',
  outputFormat: 'png',
  baseName: 'koma-split',
  suffixPattern: '{image}-part-{index}',
});

export const SPLITTER_PRESET_LABELS: Record<SplitPresetKey, string> = {
  webtoon_clean: 'Webtoon Clean',
  webtoon_dense: 'Webtoon Dense',
  mixed: 'Mixed',
  manual_first: 'Manual First',
};

const PRESET_OVERRIDES: Record<SplitPresetKey, Partial<SplitterRecipe>> = {
  webtoon_clean: {
    whitespaceSensitivity: 70,
    minSegmentSize: 1000,
    maxSegmentSize: 2600,
    overlap: 24,
    edgeGuard: 48,
  },
  webtoon_dense: {
    whitespaceSensitivity: 48,
    minSegmentSize: 780,
    maxSegmentSize: 2200,
    overlap: 36,
    edgeGuard: 24,
    noiseReduction: 32,
  },
  mixed: {
    whitespaceSensitivity: 58,
    minSegmentSize: 860,
    maxSegmentSize: 2600,
    overlap: 28,
  },
  manual_first: {
    strategy: 'manual',
    overlap: 18,
    whitespaceSensitivity: 55,
    minSegmentSize: 800,
    maxSegmentSize: 2600,
  },
};

export const applyPresetToRecipe = (
  recipe: SplitterRecipe,
  preset: SplitPresetKey,
): SplitterRecipe => ({
  ...recipe,
  ...PRESET_OVERRIDES[preset],
  preset,
});

export const resolveRecipeForImage = (
  recipe: SplitterRecipe,
  imageState?: SplitterImageState | null,
): SplitterRecipe => ({
  ...recipe,
  ...imageState?.recipeOverride,
});

export const getPrimaryAxisLength = (
  width: number,
  height: number,
  axis: SplitterRecipe['axis'],
): number => (axis === 'vertical' ? height : width);

const toCutLine = (
  position: number,
  score: number,
  source: SplitterCutLine['source'],
  warning?: string | null,
): SplitterCutLine => ({
  id: buildId('split-cut'),
  position,
  locked: false,
  score,
  source,
  warning: warning ?? null,
});

export const buildSegmentsFromCuts = (
  totalSize: number,
  cuts: SplitterCutLine[],
  overlap: number,
): SplitterSegmentPreview[] => {
  const normalizedCuts = [...cuts]
    .map((cut) => clamp(Math.round(cut.position), 0, totalSize))
    .filter((cut, index, array) => cut > 0 && cut < totalSize && array.indexOf(cut) === index)
    .sort((left, right) => left - right);
  const boundaries = [0, ...normalizedCuts, totalSize];
  const segments: SplitterSegmentPreview[] = [];
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const baseStart = boundaries[index];
    const baseEnd = boundaries[index + 1];
    if (baseStart === undefined || baseEnd === undefined) continue;
    const start = index === 0 ? baseStart : Math.max(0, baseStart - overlap);
    const end = index === boundaries.length - 2 ? baseEnd : Math.min(totalSize, baseEnd + overlap);
    const size = Math.max(1, end - start);
    let warning: string | null = null;
    if (size < 400) warning = 'Segmento muito pequeno.';
    segments.push({
      id: buildId('split-segment'),
      start,
      end,
      size,
      warning,
    });
  }
  return segments;
};

const buildWarnings = (
  recipe: SplitterRecipe,
  cuts: SplitterCutLine[],
  segments: SplitterSegmentPreview[],
): string[] => {
  const warnings: string[] = [];
  if (cuts.length === 0) warnings.push('splitter.warning.noIntermediateCuts');
  if (segments.some((segment) => segment.size < recipe.minSegmentSize)) {
    warnings.push('splitter.warning.segmentTooSmall');
  }
  if (segments.some((segment) => segment.size > recipe.maxSegmentSize)) {
    warnings.push('splitter.warning.segmentTooLarge');
  }
  if (cuts.some((cut) => cut.warning)) {
    warnings.push('splitter.warning.cutsNearContent');
  }
  return warnings;
};

const buildFixedCuts = (
  totalSize: number,
  recipe: SplitterRecipe,
  strategy: Extract<SplitStrategy, 'count' | 'fixed_height'>,
): SplitterCutLine[] => {
  if (strategy === 'count') {
    const partCount = Math.max(1, recipe.parts);
    const step = totalSize / partCount;
    return Array.from({ length: Math.max(0, partCount - 1) }, (_, index) =>
      toCutLine(Math.round(step * (index + 1)), 1, 'auto'));
  }
  const step = Math.max(100, recipe.fixedHeight);
  const cuts: SplitterCutLine[] = [];
  for (let position = step; position < totalSize; position += step) {
    cuts.push(toCutLine(position, 1, 'auto'));
  }
  return cuts;
};

const buildRowBrightness = (
  imageData: ImageData,
  width: number,
  height: number,
  axis: SplitterRecipe['axis'],
): number[] => {
  const primarySize = axis === 'vertical' ? height : width;
  const secondarySize = axis === 'vertical' ? width : height;
  const rows = Array.from({ length: primarySize }, () => 0);
  for (let primary = 0; primary < primarySize; primary += 1) {
    let sum = 0;
    for (let secondary = 0; secondary < secondarySize; secondary += 1) {
      const x = axis === 'vertical' ? secondary : primary;
      const y = axis === 'vertical' ? primary : secondary;
      const offset = (y * width + x) * 4;
      const red = imageData.data[offset] ?? 0;
      const green = imageData.data[offset + 1] ?? 0;
      const blue = imageData.data[offset + 2] ?? 0;
      sum += (red + green + blue) / 3;
    }
    rows[primary] = sum / secondarySize;
  }
  return rows;
};

const smoothSeries = (values: number[], radius: number): number[] =>
  values.map((_, index) => {
    const start = Math.max(0, index - radius);
    const end = Math.min(values.length - 1, index + radius);
    let sum = 0;
    let count = 0;
    for (let cursor = start; cursor <= end; cursor += 1) {
      sum += values[cursor] ?? 0;
      count += 1;
    }
    return sum / Math.max(1, count);
  });

const buildHeuristicCuts = (
  imageData: ImageData,
  width: number,
  height: number,
  recipe: SplitterRecipe,
): SplitterCutLine[] => {
  const totalSize = getPrimaryAxisLength(width, height, recipe.axis);
  const rows = smoothSeries(
    buildRowBrightness(imageData, width, height, recipe.axis),
    Math.max(1, Math.round(recipe.noiseReduction / 12)),
  );
  const sensitivityThreshold = 170 + Math.round((recipe.whitespaceSensitivity / 100) * 70);
  const cuts: SplitterCutLine[] = [];
  let lastCut = 0;
  const guard = Math.max(16, recipe.edgeGuard);

  for (let index = recipe.minSegmentSize; index < rows.length - guard; index += 1) {
    if (index - lastCut < recipe.minSegmentSize) continue;
    const rowBrightness = rows[index];
    if (rowBrightness === undefined) continue;
    if (rowBrightness < sensitivityThreshold) continue;

    const distanceToEnd = totalSize - index;
    if (distanceToEnd < recipe.minSegmentSize / 2) continue;

    const segmentSize = index - lastCut;
    const oversizeBoost = segmentSize > recipe.maxSegmentSize ? 0.2 : 0;
    const score = clamp(((rowBrightness - sensitivityThreshold) / 100) + oversizeBoost, 0.05, 1);
    let warning: string | null = null;
    if (index < guard || distanceToEnd < guard) warning = 'splitter.warning.nearEdge';
    if (recipe.protectTallBlocks && segmentSize > recipe.maxSegmentSize * 1.2 && score < 0.35) continue;

    cuts.push(toCutLine(index, score, 'auto', warning));
    lastCut = index;
  }

  return cuts;
};

export const analyzeSplitterRequest = async (
  request: SplitterAnalyzeRequest,
  imageData: ImageData,
  engine: 'worker' | 'advanced_desktop',
): Promise<SplitterAnalysisResult> => {
  const totalSize = getPrimaryAxisLength(request.width, request.height, request.recipe.axis);
  const strategy = request.recipe.strategy === 'manual'
    ? 'smart'
    : request.recipe.strategy;
  const cuts = strategy === 'count' || strategy === 'fixed_height'
    ? buildFixedCuts(totalSize, request.recipe, strategy)
    : buildHeuristicCuts(imageData, request.width, request.height, request.recipe);
  const segments = buildSegmentsFromCuts(totalSize, cuts, request.recipe.overlap);
  const brightnessSeries = buildRowBrightness(imageData, request.width, request.height, request.recipe.axis);
  const averageBrightness = brightnessSeries.reduce((sum, value) => sum + value, 0) / Math.max(1, brightnessSeries.length);
  const whitespaceCandidates = brightnessSeries.filter((value) => value >= 220).length;

  return {
    imageId: request.imageId,
    width: request.width,
    height: request.height,
    strategy: request.recipe.strategy,
    cuts,
    segments,
    warnings: buildWarnings(request.recipe, cuts, segments),
    diagnostics: {
      averageBrightness: Number(averageBrightness.toFixed(2)),
      whitespaceCandidates,
      engine,
    },
  };
};

export const mergeSegmentsAtIndex = (
  analysis: SplitterAnalysisResult,
  mergeIndex: number,
  recipe: SplitterRecipe,
): SplitterAnalysisResult => {
  const nextCuts = analysis.cuts.filter((_, index) => index !== mergeIndex);
  const totalSize = getPrimaryAxisLength(analysis.width, analysis.height, recipe.axis);
  return {
    ...analysis,
    cuts: nextCuts,
    segments: buildSegmentsFromCuts(totalSize, nextCuts, recipe.overlap),
  };
};

export const toggleCutLock = (
  analysis: SplitterAnalysisResult,
  cutId: string,
): SplitterAnalysisResult => ({
  ...analysis,
  cuts: analysis.cuts.map((cut) => (cut.id === cutId ? { ...cut, locked: !cut.locked } : cut)),
});

export const removeCut = (
  analysis: SplitterAnalysisResult,
  cutId: string,
  recipe: SplitterRecipe,
): SplitterAnalysisResult => {
  const nextCuts = analysis.cuts.filter((cut) => cut.id !== cutId);
  const totalSize = getPrimaryAxisLength(analysis.width, analysis.height, recipe.axis);
  return {
    ...analysis,
    cuts: nextCuts,
    segments: buildSegmentsFromCuts(totalSize, nextCuts, recipe.overlap),
    warnings: buildWarnings(recipe, nextCuts, buildSegmentsFromCuts(totalSize, nextCuts, recipe.overlap)),
  };
};

export const addManualCut = (
  analysis: SplitterAnalysisResult,
  position: number,
  recipe: SplitterRecipe,
): SplitterAnalysisResult => {
  const nextCuts = [...analysis.cuts, {
    id: buildId('split-cut'),
    position: Math.round(position),
    locked: true,
    score: 1,
    source: 'manual' as const,
    warning: null,
  }].sort((left, right) => left.position - right.position);
  const totalSize = getPrimaryAxisLength(analysis.width, analysis.height, recipe.axis);
  const segments = buildSegmentsFromCuts(totalSize, nextCuts, recipe.overlap);
  return {
    ...analysis,
    cuts: nextCuts,
    segments,
    warnings: buildWarnings(recipe, nextCuts, segments),
  };
};

export const moveCut = (
  analysis: SplitterAnalysisResult,
  cutId: string,
  nextPosition: number,
  recipe: SplitterRecipe,
): SplitterAnalysisResult => {
  const totalSize = getPrimaryAxisLength(analysis.width, analysis.height, recipe.axis);
  const nextCuts = analysis.cuts
    .map((cut) => (cut.id === cutId ? { ...cut, position: clamp(Math.round(nextPosition), 1, totalSize - 1), source: 'manual' as const } : cut))
    .sort((left, right) => left.position - right.position);
  const segments = buildSegmentsFromCuts(totalSize, nextCuts, recipe.overlap);
  return {
    ...analysis,
    cuts: nextCuts,
    segments,
    warnings: buildWarnings(recipe, nextCuts, segments),
  };
};

export const buildProcessedCanvasForImage = async (
  image: SplitterImageInput,
): Promise<HTMLCanvasElement> => {
  const dims = getRotatedDimensions(image);
  const imageBitmap = await createImageBitmap(image.file);
  const canvas = document.createElement('canvas');
  canvas.width = dims.width;
  canvas.height = dims.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Failed to prepare the image for the Splitter.');
  ctx.save();
  ctx.translate(dims.width / 2, dims.height / 2);
  ctx.rotate((image.rotation * Math.PI) / 180);
  if (image.rotation % 180 !== 0) {
    ctx.drawImage(imageBitmap, -dims.height / 2, -dims.width / 2, dims.height, dims.width);
  } else {
    ctx.drawImage(imageBitmap, -dims.width / 2, -dims.height / 2, dims.width, dims.height);
  }
  ctx.restore();
  applyImageFiltersToContext(ctx as Canvas2DLike, dims.width, dims.height, image.filters);
  imageBitmap.close();
  return canvas;
};

export const buildOutputFileName = (
  image: SplitterImageInput,
  recipe: SplitterRecipe,
  segmentIndex: number,
  extension: string,
): string => {
  const imageStem = sanitizeFileStem(image.file.name.replace(/\.[^.]+$/, ''));
  const template = recipe.suffixPattern
    .split('{image}')
    .join(imageStem)
    .split('{index}')
    .join(String(segmentIndex + 1).padStart(3, '0'));
  return `${sanitizeFileStem(recipe.baseName)}-${template}.${extension}`;
};

export const cropSegmentsFromCanvas = async (
  canvas: HTMLCanvasElement,
  image: SplitterImageInput,
  recipe: SplitterRecipe,
  analysis: SplitterAnalysisResult,
): Promise<SplitterExportEntry[]> => {
  const mimeType = getMimeTypeFromExportFormat(recipe.outputFormat);
  const extension = getExtensionFromMimeType(mimeType);
  const entries: SplitterExportEntry[] = [];

  for (let index = 0; index < analysis.segments.length; index += 1) {
    const segment = analysis.segments[index];
    if (!segment) continue;
    const exportCanvas = document.createElement('canvas');
    if (recipe.axis === 'vertical') {
      exportCanvas.width = canvas.width;
      exportCanvas.height = segment.end - segment.start;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) continue;
      ctx.drawImage(
        canvas,
        0,
        segment.start,
        canvas.width,
        segment.end - segment.start,
        0,
        0,
        canvas.width,
        segment.end - segment.start,
      );
    } else {
      exportCanvas.width = segment.end - segment.start;
      exportCanvas.height = canvas.height;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) continue;
      ctx.drawImage(
        canvas,
        segment.start,
        0,
        segment.end - segment.start,
        canvas.height,
        0,
        0,
        segment.end - segment.start,
        canvas.height,
      );
    }
    const blob = await new Promise<Blob>((resolve, reject) => {
      exportCanvas.toBlob(
        (nextBlob) => (nextBlob ? resolve(nextBlob) : reject(new Error('Failed to generate the Splitter segment.'))),
        mimeType,
        mimeType === 'image/png' ? undefined : 0.95,
      );
    });
    entries.push({
      fileName: buildOutputFileName(image, recipe, index, extension),
      blob,
      sourceImageId: image.id,
    });
  }

  return entries;
};

export const canUseDirectoryPicker = (): boolean =>
  typeof window !== 'undefined'
  && typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';
