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

export type GetStageRegions = (
  stage: StageRegionKey,
) => readonly AioTextRegion[];

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
  getRegions: GetStageRegions,
): AioTextRegion[] {
  for (const key of UPSTREAM_REGION_CHAINS[stage]) {
    const regions = getRegions(key);
    if (regions.length > 0) {
      return [...regions];
    }
  }
  return [];
}

/** Visible for tests and documentation. */
export function upstreamRegionChain(
  stage: UpstreamStage,
): readonly StageRegionKey[] {
  return UPSTREAM_REGION_CHAINS[stage];
}
