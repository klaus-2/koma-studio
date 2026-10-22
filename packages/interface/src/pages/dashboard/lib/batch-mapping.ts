/**
 * `/pipeline/batch` report → `AioBatchImageResult` mapping.
 *
 * Pure functions only: one report plus the zip entries become the same six
 * region arrays the per-image AIO path produces. The mapper never reorders
 * images: every report result is bound by its own `index` (filename only as a
 * fallback when the index is out of range) and cleaned files are bound by the
 * exact `clean.output_file` key.
 */
import {
  mergeOcrIntoRegions,
  mergeSegmentIntoRegions,
  mergeTranslationIntoRegions,
} from '@/aio-stages/merge';
import {
  resolveUpstreamRegions,
  type StageRegions,
} from '@/aio-stages/upstreamRegions';
import { buildAioCleanDownloadName } from '@/pages/dashboard/hooks/aio-stage-runner';
import type {
  AioBatchImageResult,
  AioDownloadEntry,
  AioTextRegion,
  LoadedImage,
  PipelineBatchCleanResult,
  PipelineBatchDetectResult,
  PipelineBatchItemResult,
  PipelineBatchOcrResult,
  PipelineBatchReport,
  PipelineBatchSegmentResult,
  PipelineBatchTranslationResult,
} from '@/types/dashboard.types';
import {
  applyRenderDefaultsToRegion,
  cloneAioRegions,
  cloneRenderStyle,
} from '@/utils/dashboard.utils';
import { regionsFromDetectPayload } from '@/utils/detectTextRegions';
import type { RenderTextStyle } from '@/utils/renderText';

/** Minimal image shape the mapper needs; `LoadedImage` satisfies it. */
export type BatchMappingImage = Pick<
  LoadedImage,
  'id' | 'file' | 'width' | 'height'
>;

export interface BatchMappingAioSteps {
  recognizeText: boolean;
  getTranslations: boolean;
  segmentText: boolean;
  cleanImage: boolean;
  render: boolean;
}

export interface MapBatchReportToAioResultsInput {
  report: PipelineBatchReport;
  images: ReadonlyArray<BatchMappingImage>;
  zipEntries: Readonly<Record<string, Uint8Array>> | null;
  aioSteps: BatchMappingAioSteps;
  targetLanguage: string;
  renderDefaultStyle: RenderTextStyle;
  applyDetectedGradientToStyle: (
    region: AioTextRegion,
    style: RenderTextStyle,
  ) => RenderTextStyle;
  minRegionSize: number;
  maxAreaRatio?: number;
  /** Download name override; defaults to the shared `koma-studio-aio-clean-*` template. */
  cleanFileName?: (image: BatchMappingImage, index: number) => string;
}

export interface BatchStageMappingInput {
  result: PipelineBatchItemResult;
  image: BatchMappingImage;
  aioSteps: BatchMappingAioSteps;
  targetLanguage: string;
  renderDefaultStyle: RenderTextStyle;
  applyDetectedGradientToStyle: (
    region: AioTextRegion,
    style: RenderTextStyle,
  ) => RenderTextStyle;
  minRegionSize: number;
  maxAreaRatio?: number;
}

export interface BatchStageMapping {
  detectDetections: AioTextRegion[];
  ocrDetections: AioTextRegion[];
  translationDetections: AioTextRegion[];
  segmentDetections: AioTextRegion[];
  cleanDetections: AioTextRegion[];
  renderDetections: AioTextRegion[];
  notices: string[];
  /** `clean.output_file` when the clean stage was requested, else null. */
  cleanOutputFile: string | null;
}

export class BatchMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BatchMappingError';
  }
}

interface BatchFallbackPayload {
  model_used?: string;
  fell_back_to_cpu?: boolean;
  fallback_reason?: string | null;
}

const FALLBACK_STAGE_LABELS = {
  detect: 'Detect Text',
  ocr: 'Recognize Text',
  segment: 'Segment Text',
  clean: 'Clean Image',
} as const;

type FallbackStage = keyof typeof FALLBACK_STAGE_LABELS;

const DEFAULT_CLEAN_PREFIX = 'koma-studio-aio-clean';

const defaultCleanFileName = (image: BatchMappingImage): string =>
  buildAioCleanDownloadName(DEFAULT_CLEAN_PREFIX, image.file.name);

const uniqueNotices = (notices: readonly string[]): string[] => {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const notice of notices) {
    const trimmed = notice.trim();
    if (trimmed.length === 0 || seen.has(trimmed)) continue;
    seen.add(trimmed);
    unique.push(trimmed);
  }
  return unique;
};

/**
 * Mirror `readExecutionFallbackNotice` wording for the batch payload fields.
 * The batch route has no response headers, so the reason travels in the stage
 * payload instead (`fell_back_to_cpu` + `fallback_reason`).
 */
const fallbackNotice = (
  stage: FallbackStage,
  payload: BatchFallbackPayload,
): string | null => {
  if (payload.fell_back_to_cpu !== true) return null;
  const modelKey = payload.model_used?.trim() || 'auto';
  const stageLabel = FALLBACK_STAGE_LABELS[stage];

  if (payload.fallback_reason === 'vram_to_cpu') {
    return `Model "${modelKey}" ran on CPU because free VRAM was below the model's declared requirement (decided before load) during the "${stageLabel}" stage. Processing may be slower.`;
  }
  if (payload.fallback_reason === 'gpu_oom_to_cpu') {
    return `Model "${modelKey}" fell back to CPU due to insufficient VRAM during the "${stageLabel}" stage. Processing continued on CPU and may be slower.`;
  }
  return null;
};

const collectFallbackNotices = (
  stages: ReadonlyArray<{
    stage: FallbackStage;
    payload: BatchFallbackPayload | null | undefined;
  }>,
): string[] => {
  const notices: string[] = [];
  for (const { stage, payload } of stages) {
    if (!payload) continue;
    const notice = fallbackNotice(stage, payload);
    if (notice) notices.push(notice);
  }
  return uniqueNotices(notices);
};

const backendErrorNotices = (result: PipelineBatchItemResult): string[] =>
  uniqueNotices(
    (result.errors ?? []).map((error) => `${error.stage}: ${error.message}`),
  );

const failedImageResult = (
  imageId: string,
  notices: readonly string[],
): AioBatchImageResult => ({
  imageId,
  detectDetections: [],
  ocrDetections: [],
  translationDetections: [],
  segmentDetections: [],
  cleanDetections: [],
  renderDetections: [],
  cleanedDownload: null,
  countAsProcessed: false,
  executionNotices: uniqueNotices(notices),
});

/**
 * Map one report item's stage payloads through the same provenance chain the
 * single-image processor uses. Returns arrays for every stage, the fallback
 * notices and the cleaned output key the archive must contain.
 */
export function mapBatchStagePayloads(
  input: BatchStageMappingInput,
): BatchStageMapping {
  const { result, image, aioSteps } = input;
  const stageRegions: StageRegions = {};

  const detectPayload: PipelineBatchDetectResult | null = result.detect ?? null;
  const detectRegions = detectPayload
    ? regionsFromDetectPayload(
        {
          image_width: detectPayload.image_width ?? image.width,
          image_height: detectPayload.image_height ?? image.height,
          detections: detectPayload.detections ?? [],
        },
        image,
        { minRegionSize: input.minRegionSize, maxAreaRatio: input.maxAreaRatio },
      )
    : [];
  stageRegions.detectText = detectRegions;
  const detectDetections = cloneAioRegions(detectRegions, cloneRenderStyle);

  let enrichedRegions = detectRegions;
  const ocrPayload: PipelineBatchOcrResult | null = result.ocr ?? null;
  if (aioSteps.recognizeText && ocrPayload) {
    enrichedRegions = mergeOcrIntoRegions(detectRegions, ocrPayload);
    stageRegions.recognizeText = enrichedRegions;
  }
  const ocrDetections = cloneAioRegions(enrichedRegions, cloneRenderStyle);

  const translationPayload: PipelineBatchTranslationResult | null =
    result.translation ?? null;
  if (
    aioSteps.getTranslations &&
    translationPayload &&
    (stageRegions.recognizeText?.length ?? 0) > 0
  ) {
    enrichedRegions = mergeTranslationIntoRegions(
      resolveUpstreamRegions('getTranslations', stageRegions),
      translationPayload,
    );
    stageRegions.getTranslations = enrichedRegions;
  }
  const translationDetections = cloneAioRegions(
    enrichedRegions,
    cloneRenderStyle,
  );

  const segmentPayload: PipelineBatchSegmentResult | null =
    result.segment ?? null;
  if (aioSteps.segmentText && segmentPayload) {
    enrichedRegions = mergeSegmentIntoRegions(
      resolveUpstreamRegions('segmentText', stageRegions),
      segmentPayload,
    );
    stageRegions.segmentText = enrichedRegions;
  }
  const segmentDetections = cloneAioRegions(enrichedRegions, cloneRenderStyle);

  const cleanPayload: PipelineBatchCleanResult | null = result.clean ?? null;
  let cleanOutputFile: string | null = null;
  if (aioSteps.cleanImage) {
    const cleanSourceRegions = resolveUpstreamRegions('cleanImage', stageRegions);
    stageRegions.cleanImage = cleanSourceRegions;
    cleanOutputFile = cleanPayload?.output_file ?? null;
  }
  const cleanDetections = cloneAioRegions(
    resolveUpstreamRegions('cleanImage', stageRegions),
    cloneRenderStyle,
  );

  const renderSourceRegions = resolveUpstreamRegions('render', stageRegions);
  const renderDetections = cloneAioRegions(
    aioSteps.render
      ? renderSourceRegions.map((region) =>
          applyRenderDefaultsToRegion(
            region,
            input.renderDefaultStyle,
            input.applyDetectedGradientToStyle,
            undefined,
            input.targetLanguage,
          ),
        )
      : renderSourceRegions,
    cloneRenderStyle,
  );

  return {
    detectDetections,
    ocrDetections,
    translationDetections,
    segmentDetections,
    cleanDetections,
    renderDetections,
    notices: collectFallbackNotices([
      { stage: 'detect', payload: detectPayload },
      { stage: 'ocr', payload: ocrPayload },
      { stage: 'segment', payload: segmentPayload },
      { stage: 'clean', payload: cleanPayload },
    ]),
    cleanOutputFile,
  };
}

const resolveImageForResult = (
  result: PipelineBatchItemResult,
  images: ReadonlyArray<BatchMappingImage>,
): BatchMappingImage => {
  if (result.index >= 0 && result.index < images.length) {
    const byIndex = images[result.index];
    if (byIndex) return byIndex;
  }

  const byName = images.find((image) => image.file.name === result.filename);
  if (byName) return byName;

  throw new BatchMappingError(
    `Batch result ${result.index} ("${result.filename}") does not match any queued image.`,
  );
};

/**
 * Turn a batch report (JSON body or `batch_report.json` from the zip) into the
 * per-image results consumed by the AIO consolidation step.
 *
 * Cleaned downloads require `zipEntries` when the clean stage was requested: a
 * report entry with no matching archive key produces a failed item, never a
 * download borrowed from another image.
 */
export function mapBatchReportToAioResults(
  input: MapBatchReportToAioResultsInput,
): AioBatchImageResult[] {
  const { report, images, zipEntries, aioSteps } = input;
  const cleanFileName = input.cleanFileName ?? defaultCleanFileName;

  return report.results.map((result) => {
    const image = resolveImageForResult(result, images);

    if (result.status === 'failed') {
      return failedImageResult(image.id, backendErrorNotices(result));
    }

    const mapped = mapBatchStagePayloads({
      result,
      image,
      aioSteps,
      targetLanguage: input.targetLanguage,
      renderDefaultStyle: input.renderDefaultStyle,
      applyDetectedGradientToStyle: input.applyDetectedGradientToStyle,
      minRegionSize: input.minRegionSize,
      maxAreaRatio: input.maxAreaRatio,
    });
    const notices = [...mapped.notices];
    let cleanedDownload: AioDownloadEntry | null = null;

    if (aioSteps.cleanImage) {
      const outputFile = mapped.cleanOutputFile;
      const bytes =
        outputFile !== null && zipEntries !== null
          ? zipEntries[outputFile]
          : undefined;

      if (outputFile === null || !bytes) {
        notices.push(
          `The batch report lists cleaned output "${outputFile ?? 'unknown'}" for "${result.filename}" but the archive does not contain it.`,
        );
        return failedImageResult(image.id, notices);
      }

      cleanedDownload = {
        fileName: cleanFileName(image, result.index),
        blob: new Blob([new Uint8Array(bytes)], { type: 'image/png' }),
        sourceImageId: image.id,
      };
    }

    return {
      imageId: image.id,
      detectDetections: mapped.detectDetections,
      ocrDetections: mapped.ocrDetections,
      translationDetections: mapped.translationDetections,
      segmentDetections: mapped.segmentDetections,
      cleanDetections: mapped.cleanDetections,
      renderDetections: mapped.renderDetections,
      cleanedDownload,
      countAsProcessed: true,
      executionNotices: uniqueNotices(notices),
    };
  });
}
