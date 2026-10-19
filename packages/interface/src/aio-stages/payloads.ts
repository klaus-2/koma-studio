/** Region JSON payloads for mini-backend stage calls. */
import type { AioTextRegion } from '../types/dashboard.types';
import { toApiIntegerBbox } from '../utils/dashboard.utils';
import type { StageImageRef } from './types';

const base = (region: AioTextRegion, image: StageImageRef) => ({
  id: region.id,
  bbox: toApiIntegerBbox(region.bbox, image.width, image.height),
  source: region.source,
  detector_model_key: region.detectorModelKey ?? region.modelKey,
});

const toJson = (items: readonly object[]): string => JSON.stringify(items);

export function toOcrRegionsJson(
  regions: readonly AioTextRegion[],
  image: StageImageRef,
): string {
  return toJson(regions.map((region) => base(region, image)));
}

export function toTranslateRegionsJson(
  regions: readonly AioTextRegion[],
  fallbackOcrModelKey: string,
): string {
  return toJson(
    regions.map((region) => ({
      id: region.id,
      text: region.recognizedText ?? '',
      source: region.source,
      detector_model_key: region.detectorModelKey ?? region.modelKey,
      ocr_model_key: region.ocrModelKey ?? fallbackOcrModelKey,
    })),
  );
}

export function toSegmentRegionsJson(
  regions: readonly AioTextRegion[],
  image: StageImageRef,
  fallbackOcrModelKey: string,
  fallbackTranslatorModelKey: string,
): string {
  return toJson(
    regions.map((region) => ({
      ...base(region, image),
      ocr_model_key: region.ocrModelKey ?? fallbackOcrModelKey,
      translator_model_key: region.translatorModelKey ?? fallbackTranslatorModelKey,
    })),
  );
}

export function toCleanRegionsJson(
  regions: readonly AioTextRegion[],
  image: StageImageRef,
  fallbackOcrModelKey: string,
  fallbackSegmentModelKey: string,
): string {
  return toJson(
    regions.map((region) => ({
      ...base(region, image),
      ocr_model_key: region.ocrModelKey ?? fallbackOcrModelKey,
      segment_model_key: region.segmentModelKey ?? fallbackSegmentModelKey,
      segment_boxes: region.segmentBoxes ?? [],
      merged_boxes: region.mergedSegmentBoxes ?? [],
      mask_base64: region.maskBase64 ?? '',
    })),
  );
}
