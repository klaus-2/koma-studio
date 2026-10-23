/**
 * `/pipeline/batch` wire contract: the response shapes the desktop shell reads
 * (capacity, progress, report) and the validators that turn untyped JSON into
 * them. Validation failures raise `LocalAioBatchError` — the error the whole
 * batch transport reports with, so parsing and HTTP stay one contract.
 */
import type {
  PipelineBatchCleanResult,
  PipelineBatchDetectResult,
  PipelineBatchItemError,
  PipelineBatchItemResult,
  PipelineBatchOcrResult,
  PipelineBatchReport,
  PipelineBatchSegmentResult,
  PipelineBatchStages,
  PipelineBatchTranslationResult,
} from '@/types/dashboard.types';

export class LocalAioBatchError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'LocalAioBatchError';
    this.status = status;
  }
}

/** Wire contract of `GET /pipeline/batch/capacity`. */
export interface BatchCapacity {
  maxImages: number;
  maxImageBytes: number;
  requestedConcurrency: number;
  effectiveConcurrency: number;
  perImageBudgetSeconds: number;
}

/** Wire contract of `GET /pipeline/batch/progress`. */
export interface BatchProgress {
  batchId: string;
  total: number;
  completed: number;
  failed: number;
  /**
   * Stage-start events so far; the AIO bar counts images × selected stages,
   * so this is what moves it while the first page is still working. `null` when
   * a sidecar predates the field.
   */
  stageUnitsStarted: number | null;
  currentIndex: number;
  currentName: string;
  currentStage: string | null;
  cancelled: boolean;
  finished: boolean;
  updatedAt: string;
}

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const asString = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

const asBoolean = (value: unknown): boolean | null =>
  typeof value === 'boolean' ? value : null;

const readNumber = (record: JsonRecord, key: string): number | null =>
  asNumber(record[key]);

const readString = (record: JsonRecord, key: string): string | null =>
  asString(record[key]);

const readBoolean = (record: JsonRecord, key: string): boolean | null =>
  asBoolean(record[key]);

const readSource = (record: JsonRecord): 'model' | 'manual' | null => {
  const value = record.source;
  return value === 'model' || value === 'manual' ? value : null;
};

const readRgb = (value: unknown): [number, number, number] | null => {
  if (!Array.isArray(value) || value.length < 3) return null;
  const [r, g, b] = value;
  if (
    typeof r !== 'number' ||
    !Number.isFinite(r) ||
    typeof g !== 'number' ||
    !Number.isFinite(g) ||
    typeof b !== 'number' ||
    !Number.isFinite(b)
  ) {
    return null;
  }
  return [r, g, b];
};

const readBbox = (value: unknown): [number, number, number, number] | null => {
  if (!Array.isArray(value) || value.length < 4) return null;
  const [x1, y1, x2, y2] = value;
  if (
    typeof x1 !== 'number' ||
    !Number.isFinite(x1) ||
    typeof y1 !== 'number' ||
    !Number.isFinite(y1) ||
    typeof x2 !== 'number' ||
    !Number.isFinite(x2) ||
    typeof y2 !== 'number' ||
    !Number.isFinite(y2)
  ) {
    return null;
  }
  return [x1, y1, x2, y2];
};

const readBoxes = (value: unknown): Array<[number, number, number, number]> =>
  Array.isArray(value)
    ? value
        .map(readBbox)
        .filter(
          (box): box is [number, number, number, number] => box !== null,
        )
    : [];

const readStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === 'string');
};

const parseArray = <T>(
  value: unknown,
  parse: (item: unknown) => T | null,
): T[] =>
  Array.isArray(value)
    ? value.map(parse).filter((item): item is T => item !== null)
    : [];

const readGradient = (
  value: unknown,
): {
  start_rgb: [number, number, number];
  end_rgb: [number, number, number];
  angle_degrees: number;
} | null => {
  if (!isRecord(value)) return null;
  const start = readRgb(value.start_rgb);
  const end = readRgb(value.end_rgb);
  const angle = asNumber(value.angle_degrees);
  if (!start || !end || angle === null) return null;
  return { start_rgb: start, end_rgb: end, angle_degrees: angle };
};

const readFallbackFields = (
  record: JsonRecord,
): Pick<
  PipelineBatchDetectResult,
  'fell_back_to_cpu' | 'fallback_reason'
> => ({
  fell_back_to_cpu: readBoolean(record, 'fell_back_to_cpu') ?? undefined,
  fallback_reason: readString(record, 'fallback_reason'),
});

type DetectPayloadDetection = NonNullable<
  PipelineBatchDetectResult['detections']
>[number];

type OcrPayloadRegion = NonNullable<PipelineBatchOcrResult['regions']>[number];

type TranslationPayloadRegion = NonNullable<
  PipelineBatchTranslationResult['regions']
>[number];

type SegmentPayloadRegion = NonNullable<
  PipelineBatchSegmentResult['regions']
>[number];

const parseDetectDetection = (
  value: unknown,
): DetectPayloadDetection | null => {
  if (!isRecord(value)) return null;
  const id = readString(value, 'id');
  const bbox = readBbox(value.bbox);
  const score = readNumber(value, 'score');
  const source = readSource(value);
  const modelKey = readString(value, 'model_key');
  if (
    id === null ||
    bbox === null ||
    score === null ||
    source === null ||
    modelKey === null
  ) {
    return null;
  }
  return {
    id,
    bbox,
    score,
    label: readString(value, 'label') ?? undefined,
    source,
    model_key: modelKey,
    foreground_rgb: readRgb(value.foreground_rgb),
    structural_type: readString(value, 'structural_type'),
    structural_confidence: readNumber(value, 'structural_confidence'),
    structural_source: readString(value, 'structural_source'),
    matched_reference_image: readString(value, 'matched_reference_image'),
  };
};

const parseOcrRegion = (value: unknown): OcrPayloadRegion | null => {
  if (!isRecord(value)) return null;
  const id = readString(value, 'id');
  const bbox = readBbox(value.bbox);
  const text = readString(value, 'text');
  const score = readNumber(value, 'score');
  const source = readSource(value);
  const detectorModelKey = readString(value, 'detector_model_key');
  const ocrModelKey = readString(value, 'ocr_model_key');
  if (
    id === null ||
    bbox === null ||
    text === null ||
    score === null ||
    source === null ||
    detectorModelKey === null ||
    ocrModelKey === null
  ) {
    return null;
  }
  return {
    id,
    bbox,
    text,
    score,
    source,
    detector_model_key: detectorModelKey,
    ocr_model_key: ocrModelKey,
    foreground_gradient: readGradient(value.foreground_gradient),
  };
};

const parseTranslationRegion = (
  value: unknown,
): TranslationPayloadRegion | null => {
  if (!isRecord(value)) return null;
  const id = readString(value, 'id');
  const sourceText = readString(value, 'source_text');
  const translatedText = readString(value, 'translated_text');
  const source = readSource(value);
  const detectorModelKey = readString(value, 'detector_model_key');
  const ocrModelKey = readString(value, 'ocr_model_key');
  const translatorModelKey = readString(value, 'translator_model_key');
  if (
    id === null ||
    sourceText === null ||
    translatedText === null ||
    source === null ||
    detectorModelKey === null ||
    ocrModelKey === null ||
    translatorModelKey === null
  ) {
    return null;
  }
  return {
    id,
    source_text: sourceText,
    translated_text: translatedText,
    translation_notes: readStringArray(value.translation_notes),
    source,
    detector_model_key: detectorModelKey,
    ocr_model_key: ocrModelKey,
    translator_model_key: translatorModelKey,
  };
};

const parseSegmentRegion = (value: unknown): SegmentPayloadRegion | null => {
  if (!isRecord(value)) return null;
  const id = readString(value, 'id');
  const bbox = readBbox(value.bbox);
  const source = readSource(value);
  const detectorModelKey = readString(value, 'detector_model_key');
  const ocrModelKey = readString(value, 'ocr_model_key');
  const translatorModelKey = readString(value, 'translator_model_key');
  const segmentModelKey = readString(value, 'segment_model_key');
  if (
    id === null ||
    bbox === null ||
    source === null ||
    detectorModelKey === null ||
    ocrModelKey === null ||
    translatorModelKey === null ||
    segmentModelKey === null
  ) {
    return null;
  }
  return {
    id,
    bbox,
    segment_boxes: readBoxes(value.segment_boxes),
    merged_boxes: readBoxes(value.merged_boxes),
    source,
    detector_model_key: detectorModelKey,
    ocr_model_key: ocrModelKey,
    translator_model_key: translatorModelKey,
    segment_model_key: segmentModelKey,
    mask_base64: readString(value, 'mask_base64'),
  };
};

const parseDetectPayload = (
  value: unknown,
): PipelineBatchDetectResult | null => {
  if (!isRecord(value)) return null;
  if (value.detections !== undefined && !Array.isArray(value.detections)) {
    return null;
  }
  return {
    regions_count: readNumber(value, 'regions_count') ?? undefined,
    model_used: readString(value, 'model_used') ?? undefined,
    image_width: readNumber(value, 'image_width') ?? undefined,
    image_height: readNumber(value, 'image_height') ?? undefined,
    ...readFallbackFields(value),
    detections: parseArray(value.detections, parseDetectDetection),
  };
};

const parseOcrPayload = (value: unknown): PipelineBatchOcrResult | null => {
  if (!isRecord(value)) return null;
  if (value.regions !== undefined && !Array.isArray(value.regions)) return null;
  return {
    regions_count: readNumber(value, 'regions_count') ?? undefined,
    model_used: readString(value, 'model_used') ?? undefined,
    image_width: readNumber(value, 'image_width') ?? undefined,
    image_height: readNumber(value, 'image_height') ?? undefined,
    ...readFallbackFields(value),
    regions: parseArray(value.regions, parseOcrRegion),
  };
};

const parseTranslationPayload = (
  value: unknown,
): PipelineBatchTranslationResult | null => {
  if (!isRecord(value)) return null;
  if (value.regions !== undefined && !Array.isArray(value.regions)) return null;
  return {
    regions_count: readNumber(value, 'regions_count') ?? undefined,
    model_used: readString(value, 'model_used') ?? undefined,
    source_language: readString(value, 'source_language') ?? undefined,
    target_language: readString(value, 'target_language') ?? undefined,
    regions: parseArray(value.regions, parseTranslationRegion),
  };
};

const parseSegmentPayload = (
  value: unknown,
): PipelineBatchSegmentResult | null => {
  if (!isRecord(value)) return null;
  if (value.regions !== undefined && !Array.isArray(value.regions)) return null;
  return {
    regions_count: readNumber(value, 'regions_count') ?? undefined,
    model_used: readString(value, 'model_used') ?? undefined,
    image_width: readNumber(value, 'image_width') ?? undefined,
    image_height: readNumber(value, 'image_height') ?? undefined,
    ...readFallbackFields(value),
    regions: parseArray(value.regions, parseSegmentRegion),
  };
};

const parseCleanPayload = (value: unknown): PipelineBatchCleanResult | null => {
  if (!isRecord(value)) return null;
  return {
    output_file: readString(value, 'output_file') ?? undefined,
    model_used: readString(value, 'model_used') ?? undefined,
    ...readFallbackFields(value),
  };
};

const parseItemError = (value: unknown): PipelineBatchItemError | null => {
  if (!isRecord(value)) return null;
  const stage = readString(value, 'stage');
  const message = readString(value, 'message');
  if (stage === null || message === null) return null;
  return { stage, message };
};

const parseItemStatus = (
  value: unknown,
): PipelineBatchItemResult['status'] | null => {
  if (value === 'success' || value === 'partial' || value === 'failed') {
    return value;
  }
  return null;
};

const parseItemResult = (
  value: unknown,
  position: number,
): PipelineBatchItemResult => {
  if (!isRecord(value)) {
    throw new LocalAioBatchError(
      `The batch report result #${position + 1} is not an object.`,
    );
  }
  const index = readNumber(value, 'index');
  const filename = readString(value, 'filename');
  const status = parseItemStatus(value.status);
  if (
    index === null ||
    !Number.isSafeInteger(index) ||
    index < 0 ||
    filename === null ||
    status === null
  ) {
    throw new LocalAioBatchError(
      `The batch report result #${position + 1} is missing index, filename or status.`,
    );
  }
  return {
    index,
    filename,
    status,
    detect: parseDetectPayload(value.detect),
    ocr: parseOcrPayload(value.ocr),
    translation: parseTranslationPayload(value.translation),
    segment: parseSegmentPayload(value.segment),
    clean: parseCleanPayload(value.clean),
    errors: parseArray(value.errors, parseItemError),
  };
};

const parseBatchStages = (value: unknown): PipelineBatchStages => {
  const record = isRecord(value) ? value : {};
  return {
    detect: readBoolean(record, 'detect') ?? false,
    ocr: readBoolean(record, 'ocr') ?? false,
    translation: readBoolean(record, 'translation') ?? false,
    segment: readBoolean(record, 'segment') ?? false,
    clean: readBoolean(record, 'clean') ?? false,
  };
};

const requireCount = (
  record: JsonRecord,
  key: string,
): number => {
  const value = readNumber(record, key);
  if (value === null || !Number.isSafeInteger(value) || value < 0) {
    throw new LocalAioBatchError(
      `The batch report is missing a valid "${key}".`,
    );
  }
  return value;
};

/** Validate the report enough to map it without trusting the JSON shape. */
export function parsePipelineBatchReport(value: unknown): PipelineBatchReport {
  if (!isRecord(value)) {
    throw new LocalAioBatchError('The batch report is not an object.');
  }
  if (!Array.isArray(value.results)) {
    throw new LocalAioBatchError('The batch report is missing its results array.');
  }
  const results = value.results.map((item, position) =>
    parseItemResult(item, position),
  );
  return {
    batch_id: readString(value, 'batch_id') ?? undefined,
    total_images: requireCount(value, 'total_images'),
    succeeded: requireCount(value, 'succeeded'),
    partial: requireCount(value, 'partial'),
    failed: requireCount(value, 'failed'),
    stages: parseBatchStages(value.stages),
    results,
    requested_concurrency: readNumber(value, 'requested_concurrency') ?? undefined,
    effective_concurrency: readNumber(value, 'effective_concurrency') ?? undefined,
    concurrency_note: readString(value, 'concurrency_note'),
  };
}

/** `GET /pipeline/batch/capacity` response: every limit must be a usable number. */
export function parseBatchCapacity(payload: unknown, status: number): BatchCapacity {
  if (!isRecord(payload)) {
    throw new LocalAioBatchError(
      'The batch capacity response is not an object.',
      status,
    );
  }

  const maxImages = readNumber(payload, 'maxImages');
  const maxImageBytes = readNumber(payload, 'maxImageBytes');
  const requestedConcurrency = readNumber(payload, 'requestedConcurrency');
  const effectiveConcurrency = readNumber(payload, 'effectiveConcurrency');
  const perImageBudgetSeconds = readNumber(payload, 'perImageBudgetSeconds');
  if (
    maxImages === null ||
    !Number.isSafeInteger(maxImages) ||
    maxImages < 1 ||
    maxImageBytes === null ||
    !Number.isSafeInteger(maxImageBytes) ||
    maxImageBytes < 1 ||
    requestedConcurrency === null ||
    !Number.isSafeInteger(requestedConcurrency) ||
    requestedConcurrency < 1 ||
    effectiveConcurrency === null ||
    !Number.isSafeInteger(effectiveConcurrency) ||
    effectiveConcurrency < 1 ||
    perImageBudgetSeconds === null ||
    perImageBudgetSeconds <= 0
  ) {
    throw new LocalAioBatchError(
      'The batch capacity response is missing valid limits.',
      status,
    );
  }

  return {
    maxImages,
    maxImageBytes,
    requestedConcurrency,
    effectiveConcurrency,
    perImageBudgetSeconds,
  };
}

/** `GET /pipeline/batch/progress` response; a 404 never reaches this parser. */
export function parseBatchProgress(payload: unknown, status: number): BatchProgress {
  if (!isRecord(payload)) {
    throw new LocalAioBatchError(
      'The batch progress response is not an object.',
      status,
    );
  }

  const batchId = readString(payload, 'batchId');
  const total = readNumber(payload, 'total');
  const completed = readNumber(payload, 'completed');
  const failed = readNumber(payload, 'failed');
  const currentIndex = readNumber(payload, 'currentIndex');
  // Absent on a sidecar older than this field; the caller then falls back to
  // counting finished items instead of failing the run.
  const reportedStageUnits = readNumber(payload, 'stageUnitsStarted');
  const reportedStage = readString(payload, 'currentStage');
  const currentName = readString(payload, 'currentName');
  const cancelled = readBoolean(payload, 'cancelled');
  const finished = readBoolean(payload, 'finished');
  const updatedAt = readString(payload, 'updatedAt');
  if (
    batchId === null ||
    total === null ||
    !Number.isSafeInteger(total) ||
    total < 0 ||
    completed === null ||
    !Number.isSafeInteger(completed) ||
    completed < 0 ||
    failed === null ||
    !Number.isSafeInteger(failed) ||
    failed < 0 ||
    currentIndex === null ||
    !Number.isSafeInteger(currentIndex) ||
    currentIndex < 0 ||
    currentName === null ||
    cancelled === null ||
    finished === null ||
    updatedAt === null
  ) {
    throw new LocalAioBatchError(
      'The batch progress response is missing valid fields.',
      status,
    );
  }

  return {
    batchId,
    total,
    completed,
    failed,
    stageUnitsStarted: reportedStageUnits,
    currentIndex,
    currentName,
    currentStage: reportedStage === '' ? null : reportedStage,
    cancelled,
    finished,
    updatedAt,
  };
}
