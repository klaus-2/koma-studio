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

export function mergeOcrIntoRegions(
  regions: readonly AioTextRegion[],
  payload: OcrApiResponse,
): AioTextRegion[] {
  const byId = new Map(payload.regions.map((region) => [String(region.id), region]));
  return regions.map((region, index) => {
    const match = byId.get(String(region.id)) ?? payload.regions[index] ?? null;
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
  payload: TranslationApiResponse,
): AioTextRegion[] {
  const byId = new Map(payload.regions.map((region) => [region.id, region]));
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
  payload: SegmentApiResponse,
): AioTextRegion[] {
  const byId = new Map(payload.regions.map((region) => [region.id, region]));
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
