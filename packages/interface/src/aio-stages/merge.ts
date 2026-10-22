/** Stage response → Region merge policy. */
import type {
  AioTextRegion,
  OcrApiResponse,
  SegmentApiResponse,
  TranslationApiResponse,
} from '../types/dashboard.types';
import {
  normalizeDetectedGradient,
  normalizeTranslationNotes,
} from '../utils/dashboard.utils';

const normalizedRenderText = (value: string | undefined): string | undefined =>
  typeof value === 'string' && value.trim().length === 0 ? undefined : value;

/**
 * Structural payloads shared by the single-image stage responses and the
 * batch report. The batch report may omit `regions` on a stage that ran but
 * produced nothing, so the merge helpers treat a missing list as empty.
 */
export interface OcrRegionsMergePayload {
  regions?: ReadonlyArray<OcrApiResponse['regions'][number]>;
}

export interface TranslationRegionsMergePayload {
  regions?: ReadonlyArray<TranslationApiResponse['regions'][number]>;
}

export type SegmentRegionMergePayload = Omit<
  SegmentApiResponse['regions'][number],
  'mask_base64'
> & {
  mask_base64?: string | null;
};

export interface SegmentRegionsMergePayload {
  regions?: ReadonlyArray<SegmentRegionMergePayload>;
}

export function mergeOcrIntoRegions(
  regions: readonly AioTextRegion[],
  payload: OcrRegionsMergePayload,
): AioTextRegion[] {
  const payloadRegions = payload.regions ?? [];
  const byId = new Map(payloadRegions.map((region) => [String(region.id), region]));
  return regions.map((region, index) => {
    const match = byId.get(String(region.id)) ?? payloadRegions[index] ?? null;
    if (!match) return { ...region };
    return {
      ...region,
      renderText: normalizedRenderText(region.renderText),
      recognizedText: match.text,
      ocrScore: match.score,
      ocrModelKey: match.ocr_model_key,
      detectedGradient: normalizeDetectedGradient(match.foreground_gradient),
    };
  });
}

export function mergeTranslationIntoRegions(
  regions: readonly AioTextRegion[],
  payload: TranslationRegionsMergePayload,
): AioTextRegion[] {
  const byId = new Map((payload.regions ?? []).map((region) => [region.id, region]));
  return regions.map((region) => {
    const match = byId.get(region.id);
    if (!match) return { ...region };
    return {
      ...region,
      renderText: normalizedRenderText(region.renderText),
      translatedText: match.translated_text,
      translationNotes: normalizeTranslationNotes(match.translation_notes),
      translationNoteOverlay: undefined,
      translatorModelKey: match.translator_model_key,
    };
  });
}

export function mergeSegmentIntoRegions(
  regions: readonly AioTextRegion[],
  payload: SegmentRegionsMergePayload,
): AioTextRegion[] {
  const byId = new Map((payload.regions ?? []).map((region) => [region.id, region]));
  return regions.map((region) => {
    const match = byId.get(region.id);
    if (!match) return { ...region };
    return {
      ...region,
      segmentBoxes: match.segment_boxes,
      mergedSegmentBoxes: match.merged_boxes,
      segmentModelKey: match.segment_model_key,
      maskBase64: match.mask_base64 ?? undefined,
    };
  });
}
