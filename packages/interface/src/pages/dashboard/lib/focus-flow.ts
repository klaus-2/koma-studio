/**
 * Focus Mode flow derivations.
 *
 * The Focus stepper is never stored: it is derived from the real pipeline
 * state (images, processed flags, regions, downloads, review marks) so the
 * UI can never disagree with the workspace. Everything here is pure and
 * framework-free, which keeps the four-step contract unit-testable.
 *
 * Steps: `pages` (nothing loaded) → `run` (nothing processed yet) →
 * `review` (processed pages still unreviewed) → `export` (all processed
 * pages reviewed). The steps are an indicator, not a lock: pages can be
 * added, the pipeline re-run and the chapter exported from any step where
 * the underlying data allows it.
 */

export type FocusStepId = 'pages' | 'run' | 'review' | 'export';

export const FOCUS_STEP_ORDER: readonly FocusStepId[] = [
  'pages',
  'run',
  'review',
  'export',
];

/** Minimal region shape the flow derivation needs (text presence only). */
export interface FocusRegionText {
  renderText?: string | null;
  translatedText?: string | null;
  recognizedText?: string | null;
}

export interface FocusPageFlow {
  imageId: string;
  /** True once the page went through a completed AIO run (or equivalent). */
  processed: boolean;
  reviewed: boolean;
  regionCount: number;
  /** Regions with no renderable text — the primary "fix me" signal. */
  emptyRegionCount: number;
}

export interface FocusFlowState {
  step: FocusStepId;
  pages: FocusPageFlow[];
  totalPages: number;
  processedPages: number;
  /** Reviewed among processed pages (review only counts after a run). */
  reviewedPages: number;
  /** Processed-but-unreviewed page ids, in page order — the review queue. */
  unreviewedPageIds: string[];
  emptyRegionTotal: number;
  canRun: boolean;
  canExport: boolean;
}

export interface FocusFlowInputs {
  images: readonly { id: string }[];
  /** `aioAutoProcessedImageById` from the AIO pipeline store. */
  processedById: Readonly<Record<string, boolean>>;
  detectionsByImage: Readonly<
    Record<string, readonly FocusRegionText[] | undefined>
  >;
  /** Image ids that own an AIO-scope download (cleaned output). */
  downloadImageIds: ReadonlySet<string>;
  reviewedImageIds: readonly string[];
}

const regionHasText = (region: FocusRegionText): boolean =>
  (region.renderText ?? region.translatedText ?? '').trim().length > 0;

/**
 * A page counts as processed when the pipeline marked it, when it owns a
 * cleaned download, or — for restored workspaces whose flags predate the
 * run bookkeeping — when it already carries translated regions.
 */
const isPageProcessed = (
  imageId: string,
  regions: readonly FocusRegionText[],
  inputs: FocusFlowInputs,
): boolean => {
  if (inputs.processedById[imageId] === true) return true;
  if (inputs.downloadImageIds.has(imageId)) return true;
  return regions.some((region) => regionHasText(region));
};

export function buildFocusFlowState(inputs: FocusFlowInputs): FocusFlowState {
  const reviewed = new Set(inputs.reviewedImageIds);

  const pages: FocusPageFlow[] = inputs.images.map((image) => {
    const regions = inputs.detectionsByImage[image.id] ?? [];
    const processed = isPageProcessed(image.id, regions, inputs);
    return {
      imageId: image.id,
      processed,
      reviewed: reviewed.has(image.id),
      regionCount: regions.length,
      emptyRegionCount: processed
        ? regions.filter((region) => !regionHasText(region)).length
        : 0,
    };
  });

  const processedPages = pages.filter((page) => page.processed).length;
  const reviewedPages = pages.filter(
    (page) => page.processed && page.reviewed,
  ).length;
  const unreviewedPageIds = pages
    .filter((page) => page.processed && !page.reviewed)
    .map((page) => page.imageId);
  const emptyRegionTotal = pages.reduce(
    (sum, page) => sum + page.emptyRegionCount,
    0,
  );

  const step: FocusStepId =
    pages.length === 0
      ? 'pages'
      : processedPages === 0
        ? 'run'
        : unreviewedPageIds.length > 0
          ? 'review'
          : 'export';

  return {
    step,
    pages,
    totalPages: pages.length,
    processedPages,
    reviewedPages,
    unreviewedPageIds,
    emptyRegionTotal,
    canRun: pages.length > 0,
    canExport: processedPages > 0,
  };
}

/**
 * Next unreviewed processed page after `fromImageId` (wrapping to the
 * first), used by "mark reviewed & continue". `extraReviewedId` lets the
 * caller preview the queue as if that page were already marked, before
 * the store update lands.
 */
export function findNextUnreviewedPageId(
  flow: FocusFlowState,
  fromImageId: string | null,
  extraReviewedId?: string,
): string | null {
  const queue = flow.pages.filter(
    (page) =>
      page.processed && !page.reviewed && page.imageId !== extraReviewedId,
  );
  if (queue.length === 0) return null;
  if (!fromImageId) return queue[0]?.imageId ?? null;

  const fromIndex = flow.pages.findIndex((page) => page.imageId === fromImageId);
  const after = queue.find((page) => {
    const index = flow.pages.findIndex((entry) => entry.imageId === page.imageId);
    return index > fromIndex;
  });
  return (after ?? queue[0])?.imageId ?? null;
}

/** Pipeline stage toggles Focus expects on (the full automatic pipeline). */
export interface FocusStageToggles {
  detectText: boolean;
  recognizeText: boolean;
  getTranslations: boolean;
  segmentText: boolean;
  cleanImage: boolean;
  render: boolean;
}

export type FocusStageKey = keyof FocusStageToggles;

export const FOCUS_PIPELINE_STAGE_ORDER: readonly FocusStageKey[] = [
  'detectText',
  'recognizeText',
  'getTranslations',
  'segmentText',
  'cleanImage',
  'render',
];

export const FULL_FOCUS_STAGE_TOGGLES: FocusStageToggles = {
  detectText: true,
  recognizeText: true,
  getTranslations: true,
  segmentText: true,
  cleanImage: true,
  render: true,
};

/** Stages switched off in Studio that Focus would silently inherit. */
export function findDisabledFocusStages(
  steps: FocusStageToggles,
): FocusStageKey[] {
  return FOCUS_PIPELINE_STAGE_ORDER.filter((stage) => !steps[stage]);
}
