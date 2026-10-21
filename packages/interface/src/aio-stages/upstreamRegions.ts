/**
 * Upstream Region provenance — which Regions feed each AIO stage.
 * One chain per stage so manual, Cleaner and auto stop encoding fallbacks.
 */
import type { AioTextRegion } from '../types/dashboard.types';

export type StageRegionKey =
  | 'detectText'
  | 'recognizeText'
  | 'getTranslations'
  | 'segmentText'
  | 'cleanImage';

export type UpstreamStage =
  | 'getTranslations'
  | 'segmentText'
  | 'cleanImage'
  | 'render';

/** Stage → Regions written so far (snapshot map or linear pipeline map). */
export type StageRegions = Partial<Record<StageRegionKey, readonly AioTextRegion[]>>;

/**
 * Preferred upstream order per stage. First non-empty snapshot wins.
 * Sits beside the Detect Text → Region adapter family: provenance is part
 * of the AIO stage-run module, not of each orchestrator.
 */
const UPSTREAM_REGION_CHAINS: Record<
  UpstreamStage,
  readonly StageRegionKey[]
> = {
  getTranslations: ['recognizeText'],
  segmentText: ['getTranslations', 'recognizeText', 'detectText'],
  cleanImage: ['segmentText', 'getTranslations', 'recognizeText', 'detectText'],
  render: [
    'cleanImage',
    'segmentText',
    'getTranslations',
    'recognizeText',
    'detectText',
  ],
};

/**
 * Resolve the Regions that feed `stage`. Returns a new array (region objects
 * are shared — stage-run modules treat them as read-only inputs).
 */
export function resolveUpstreamRegions(
  stage: UpstreamStage,
  stageRegions: StageRegions,
): AioTextRegion[] {
  for (const key of UPSTREAM_REGION_CHAINS[stage]) {
    const regions = stageRegions[key];
    if (regions && regions.length > 0) {
      return [...regions];
    }
  }
  return [];
}

/** Every AIO stage whose runnability the provenance module can verdict. */
export type AioStageKey = StageRegionKey | UpstreamStage;

/** Why a stage cannot run with the current stage regions. */
export type StageNotRunnableReason = 'no_regions' | 'no_recognized_text';

/** Provenance verdict: can `stage` run with these stage regions? */
export interface AioStageReadiness {
  runnable: boolean;
  reason: StageNotRunnableReason | null;
}

// Input chains for the two stages that are sources, not downstream consumers.
const STAGE_INPUT_CHAINS: Record<AioStageKey, readonly StageRegionKey[]> = {
  detectText: [],
  recognizeText: ['detectText'],
  ...UPSTREAM_REGION_CHAINS,
};

/**
 * Runnable/not-runnable verdict for a stage, derived from the same fallback
 * chains `resolveUpstreamRegions` uses — so every orchestrator (manual,
 * auto, Cleaner) aligns on one set of rules.
 *
 * Intended alignment with the chains: a stage is runnable when ANY
 * upstream source on its chain is non-empty — e.g. segmentText accepts a
 * detect-text fallback and cleanImage accepts a getTranslations fallback
 * (regions sourced from translations when segmentation is absent).
 */
export function getAioStageReadiness(
  stage: AioStageKey,
  stageRegions: StageRegions,
): AioStageReadiness {
  if (stage === 'detectText') {
    return { runnable: true, reason: null };
  }

  if (stage === 'getTranslations') {
    // Translating requires recognized TEXT, not just detected boxes.
    const ocrRegions = stageRegions.recognizeText;
    const hasText = (ocrRegions ?? []).some(
      (region) => (region.recognizedText ?? '').trim().length > 0,
    );
    return hasText
      ? { runnable: true, reason: null }
      : { runnable: false, reason: 'no_recognized_text' };
  }

  const runnable = STAGE_INPUT_CHAINS[stage].some((key) => {
    const regions = stageRegions[key];
    return regions !== undefined && regions.length > 0;
  });
  return runnable
    ? { runnable: true, reason: null }
    : { runnable: false, reason: 'no_regions' };
}
