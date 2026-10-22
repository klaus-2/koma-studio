/**
 * Local (non-cloud) AIO batch transport: one `POST /pipeline/batch` request per
 * chunk of up to 20 images, a capacity preflight and 500 ms progress polling.
 * The response shapes are validated in `batch-wire.ts`; the report becomes
 * per-image results through `batch-mapping.ts`.
 *
 * Every request carries a client-generated `batch_id` (shared with the poller,
 * so progress is observable while the request is still in flight) and the
 * server echoes it as `X-Koma-Batch-Id`.
 */
import { strFromU8, unzipSync } from 'fflate';

import {
  mapBatchReportToAioResults,
  type BatchMappingAioSteps,
  type BatchMappingImage,
} from '@/pages/dashboard/lib/batch-mapping';
import {
  LocalAioBatchError,
  parseBatchCapacity,
  parseBatchProgress,
  parsePipelineBatchReport,
  type BatchCapacity,
  type BatchProgress,
} from '@/pages/dashboard/lib/batch-wire';
import { createAioAbortError } from '@/pages/dashboard/lib/run-aio-batch';
import type {
  AioBatchImageResult,
  AioTextRegion,
  PipelineBatchReport,
} from '@/types/dashboard.types';
import type { LlmRequestSettings } from '@/utils/customLlm';
import { parseResponseErrorMessage } from '@/utils/dashboard.utils';
import { fetchWithTimeoutAndRetry } from '@/utils/http';
import type { RenderTextStyle } from '@/utils/renderText';

export const BATCH_REPORT_FILENAME = 'batch_report.json';

/** The backend accepts up to 64 images; the client sends at most 20 per chunk. */
export const LOCAL_AIO_BATCH_CHUNK_SIZE = 20;
export const BATCH_PROGRESS_POLL_INTERVAL_MS = 500;

export const FALLBACK_BATCH_MAX_IMAGES = 64;
export const FALLBACK_BATCH_MAX_IMAGE_BYTES = 50 * 1024 * 1024;
export const FALLBACK_BATCH_EFFECTIVE_CONCURRENCY = 4;
export const FALLBACK_BATCH_PER_IMAGE_BUDGET_SECONDS = 1_200;

const CAPACITY_TIMEOUT_MS = 10_000;
const PROGRESS_TIMEOUT_MS = 10_000;
const REQUEST_SLACK_MS = 120_000;

export interface FetchBatchCapacityInput {
  localApiUrl: string;
  concurrency: number;
  signal?: AbortSignal;
}

export interface LocalAioBatchGpuStages {
  detectText: boolean;
  recognizeText: boolean;
  segmentText: boolean;
  cleanImage: boolean;
}

export interface LocalAioBatchOptions {
  sourceLanguage: string;
  targetLanguage: string;
  detectModelKey: string;
  ocrModelKey: string;
  translationModelKey: string;
  segmentModelKey: string;
  cleanModelKey: string;
  aioSteps: BatchMappingAioSteps;
  llmSettings: LlmRequestSettings;
  maskDilation: number;
  hdStrategy: string;
  hdResizeLimit: number;
  hdCropMargin: number;
  hdCropTriggerSize: number;
  gpuStages?: LocalAioBatchGpuStages;
  renderDefaultStyle: RenderTextStyle;
  applyDetectedGradientToStyle: (
    region: AioTextRegion,
    style: RenderTextStyle,
  ) => RenderTextStyle;
  minRegionSize: number;
  maxAreaRatio?: number;
  cleanFileName?: (image: BatchMappingImage, index: number) => string;
  parseApiError: (response: Response) => Promise<string>;
}

export interface RunLocalAioBatchInput {
  localApiUrl: string;
  images: ReadonlyArray<BatchMappingImage>;
  options: LocalAioBatchOptions;
  capacity: BatchCapacity;
  signal?: AbortSignal;
  /**
   * Caller-owned id, so a progress poller can follow the run before the POST
   * resolves. Generated locally when omitted.
   */
  batchId?: string;
  /** Fired synchronously with the resolved id, before the request is sent. */
  onBatchId?: (batchId: string) => void;
  /** Fired once the mapped results are ready (no polling in this helper). */
  onProgress?: (completed: number, total: number) => void;
}

export interface FetchBatchProgressInput {
  localApiUrl: string;
  batchId: string;
  signal?: AbortSignal;
}

export interface StartBatchProgressPollingInput {
  localApiUrl: string;
  batchId: string;
  signal: AbortSignal;
  onUpdate: (progress: BatchProgress) => void;
  intervalMs?: number;
}

export interface ResolveBatchCapacityInput {
  localApiUrl: string;
  concurrency: number;
}

export interface ResolvedBatchCapacity {
  capacity: BatchCapacity;
  /** True when the preflight failed and the conservative defaults were used. */
  fallback: boolean;
}

export interface RunLocalAioBatchChunksInput {
  localApiUrl: string;
  images: ReadonlyArray<BatchMappingImage>;
  options: LocalAioBatchOptions;
  capacity: BatchCapacity;
  signal: AbortSignal;
  /** Run-wide completed/total, offset by the finished chunks. */
  onProgress?: (completed: number, total: number) => void;
  /** Current chunk (`1..chunkCount`) plus the image the backend is working on. */
  onChunkState?: (
    chunkNumber: number,
    chunkCount: number,
    currentName: string,
  ) => void;
}

export interface LocalAioBatchChunksResult {
  batchIds: string[];
  results: AioBatchImageResult[];
}

export interface LocalAioBatchRunResult {
  batchId: string;
  report: PipelineBatchReport;
  results: AioBatchImageResult[];
  zipEntries: Readonly<Record<string, Uint8Array>> | null;
}


const joinUrl = (base: string, path: string): string =>
  `${base.replace(/\/+$/, '')}${path}`;

const readJsonBody = async (
  response: Response,
  invalidMessage: string,
): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    throw new LocalAioBatchError(invalidMessage, response.status);
  }
};

/**
 * `GET /pipeline/batch/capacity` preflight. No session header: the desktop
 * origin is admitted before the session check on the local backend.
 */
export async function fetchBatchCapacity({
  localApiUrl,
  concurrency,
  signal,
}: FetchBatchCapacityInput): Promise<BatchCapacity> {
  const response = await fetchWithTimeoutAndRetry(
    `${joinUrl(localApiUrl, '/pipeline/batch/capacity')}?concurrency=${encodeURIComponent(String(concurrency))}`,
    { method: 'GET' },
    { timeoutMs: CAPACITY_TIMEOUT_MS, retryCount: 0, signal },
  );

  if (!response.ok) {
    throw new LocalAioBatchError(
      await parseResponseErrorMessage(response),
      response.status,
    );
  }

  return parseBatchCapacity(
    await readJsonBody(
      response,
      'The batch capacity response is not valid JSON.',
    ),
    response.status,
  );
}

/**
 * Conservative preflight fallback when the capacity probe is unreachable: 64
 * images of 50 MiB, a 1200 s per-image budget and at most 4 effective threads —
 * never more than the caller requested.
 */
export function buildFallbackBatchCapacity(
  requestedConcurrency: number,
): BatchCapacity {
  return {
    maxImages: FALLBACK_BATCH_MAX_IMAGES,
    maxImageBytes: FALLBACK_BATCH_MAX_IMAGE_BYTES,
    requestedConcurrency,
    effectiveConcurrency: Math.max(
      1,
      Math.min(FALLBACK_BATCH_EFFECTIVE_CONCURRENCY, requestedConcurrency),
    ),
    perImageBudgetSeconds: FALLBACK_BATCH_PER_IMAGE_BUDGET_SECONDS,
  };
}

/**
 * One preflight per run. A failure is not fatal: the documented conservative
 * capacity is returned with `fallback: true` so the run still starts.
 */
export async function resolveBatchCapacity({
  localApiUrl,
  concurrency,
}: ResolveBatchCapacityInput): Promise<ResolvedBatchCapacity> {
  try {
    const capacity = await fetchBatchCapacity({ localApiUrl, concurrency });
    return { capacity, fallback: false };
  } catch {
    return {
      capacity: buildFallbackBatchCapacity(concurrency),
      fallback: true,
    };
  }
}


/**
 * `GET /pipeline/batch/progress`. Returns `null` for 404 — the backend reports
 * an unknown, expired (or not yet registered) batch that way.
 */
export async function fetchBatchProgress({
  localApiUrl,
  batchId,
  signal,
}: FetchBatchProgressInput): Promise<BatchProgress | null> {
  const response = await fetchWithTimeoutAndRetry(
    `${joinUrl(localApiUrl, '/pipeline/batch/progress')}?batch_id=${encodeURIComponent(batchId)}`,
    { method: 'GET' },
    { timeoutMs: PROGRESS_TIMEOUT_MS, retryCount: 0, signal },
  );

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new LocalAioBatchError(
      await parseResponseErrorMessage(response),
      response.status,
    );
  }

  const payload = await readJsonBody(
    response,
    'The batch progress response is not valid JSON.',
  );
  return parseBatchProgress(payload, response.status);
}

/**
 * Poll progress every 500 ms until the run finishes/is cancelled, the signal
 * aborts or the caller stops it. A 404 means the backend has not registered the
 * batch yet (uploads are spooled before registration) or the entry already
 * expired, so it must NOT stop the ticker: the chunk request's completion (or
 * its abort) stops it through the caller's `finally`. Other poll failures stop
 * the ticker without failing the batch. The returned stop function is
 * idempotent and always clears the timer.
 */
export function startBatchProgressPolling({
  localApiUrl,
  batchId,
  signal,
  onUpdate,
  intervalMs = BATCH_PROGRESS_POLL_INTERVAL_MS,
}: StartBatchProgressPollingInput): () => void {
  let stopped = false;
  let inFlight = false;

  const stop = (): void => {
    if (stopped) {
      return;
    }
    stopped = true;
    clearInterval(timer);
    signal.removeEventListener('abort', stop);
  };

  const tick = async (): Promise<void> => {
    if (stopped || inFlight) {
      return;
    }
    if (signal.aborted) {
      stop();
      return;
    }

    inFlight = true;
    try {
      const progress = await fetchBatchProgress({
        localApiUrl,
        batchId,
        signal,
      });
      if (progress === null) {
        // Not registered yet (upload still spooling) or expired: keep ticking.
        return;
      }
      if (stopped || signal.aborted) {
        return;
      }
      onUpdate(progress);
      if (progress.finished || progress.cancelled) {
        stop();
      }
    } catch {
      stop();
    } finally {
      inFlight = false;
    }
  };

  const timer = setInterval(() => {
    void tick();
  }, intervalMs);

  if (signal.aborted) {
    stop();
  } else {
    signal.addEventListener('abort', stop, { once: true });
  }

  return stop;
}

export const createBatchId = (): string => crypto.randomUUID();

const appendBoolean = (
  form: FormData,
  key: string,
  value: boolean,
): void => {
  form.append(key, value ? 'true' : 'false');
};

const buildBatchForm = (
  images: ReadonlyArray<BatchMappingImage>,
  options: LocalAioBatchOptions,
  capacity: BatchCapacity,
  batchId: string,
): FormData => {
  const form = new FormData();
  for (const image of images) {
    form.append('files', image.file, image.file.name);
  }

  form.append('source_language', options.sourceLanguage);
  form.append('target_language', options.targetLanguage);
  form.append('detect_model_key', options.detectModelKey);
  form.append('ocr_model_key', options.ocrModelKey);
  form.append('translation_model_key', options.translationModelKey);
  form.append('segment_model_key', options.segmentModelKey);
  form.append('clean_model_key', options.cleanModelKey);
  form.append('run_detect', 'true');
  appendBoolean(form, 'run_ocr', options.aioSteps.recognizeText);
  appendBoolean(form, 'run_translation', options.aioSteps.getTranslations);
  appendBoolean(form, 'run_segment', options.aioSteps.segmentText);
  appendBoolean(form, 'run_clean', options.aioSteps.cleanImage);
  form.append('concurrency', String(capacity.effectiveConcurrency));
  form.append('batch_id', batchId);
  form.append('mask_dilation', String(options.maskDilation));
  form.append('hd_strategy', options.hdStrategy);
  form.append('hd_strategy_resize_limit', String(options.hdResizeLimit));
  form.append('hd_strategy_crop_margin', String(options.hdCropMargin));
  form.append('hd_strategy_crop_trigger_size', String(options.hdCropTriggerSize));
  form.append('llm_settings', JSON.stringify(options.llmSettings));

  if (options.gpuStages) {
    appendBoolean(form, 'use_gpu_detect', options.gpuStages.detectText);
    appendBoolean(form, 'use_gpu_ocr', options.gpuStages.recognizeText);
    appendBoolean(form, 'use_gpu_segment', options.gpuStages.segmentText);
    appendBoolean(form, 'use_gpu_clean', options.gpuStages.cleanImage);
  }

  return form;
};

const resolveTimeoutMs = (
  imageCount: number,
  capacity: BatchCapacity,
): number => {
  if (
    !Number.isSafeInteger(capacity.effectiveConcurrency) ||
    capacity.effectiveConcurrency < 1
  ) {
    throw new LocalAioBatchError(
      'The batch capacity response has an invalid effective concurrency.',
    );
  }
  if (
    !Number.isFinite(capacity.perImageBudgetSeconds) ||
    capacity.perImageBudgetSeconds <= 0
  ) {
    throw new LocalAioBatchError(
      'The batch capacity response has an invalid per-image budget.',
    );
  }
  const waves = Math.max(
    1,
    Math.ceil(imageCount / capacity.effectiveConcurrency),
  );
  return (
    capacity.perImageBudgetSeconds * 1000 * waves + REQUEST_SLACK_MS
  );
};

const readZipReport = (
  entries: Record<string, Uint8Array>,
  status: number,
): PipelineBatchReport => {
  const reportBytes = entries[BATCH_REPORT_FILENAME];
  if (!reportBytes) {
    throw new LocalAioBatchError(
      `The batch archive does not contain ${BATCH_REPORT_FILENAME}.`,
      status,
    );
  }
  let payload: unknown;
  try {
    payload = JSON.parse(strFromU8(reportBytes));
  } catch {
    throw new LocalAioBatchError(
      `${BATCH_REPORT_FILENAME} is not valid JSON.`,
      status,
    );
  }
  return parsePipelineBatchReport(payload);
};

/**
 * Execute every image through one `/pipeline/batch` request and map the
 * response back to `AioBatchImageResult[]`.
 */
export async function runLocalAioBatch({
  localApiUrl,
  images,
  options,
  capacity,
  signal,
  batchId: requestedBatchId,
  onBatchId,
  onProgress,
}: RunLocalAioBatchInput): Promise<LocalAioBatchRunResult> {
  if (images.length === 0) {
    throw new LocalAioBatchError('The batch has no images.');
  }
  if (images.length > capacity.maxImages) {
    throw new LocalAioBatchError(
      `The batch has ${images.length} images but the local backend accepts at most ${capacity.maxImages} per request.`,
    );
  }

  const timeoutMs = resolveTimeoutMs(images.length, capacity);
  const batchId = requestedBatchId?.trim() || createBatchId();
  onBatchId?.(batchId);
  const form = buildBatchForm(images, options, capacity, batchId);

  const response = await fetchWithTimeoutAndRetry(
    joinUrl(localApiUrl, '/pipeline/batch'),
    { method: 'POST', body: form },
    { timeoutMs, retryCount: 0, signal },
  );

  if (!response.ok) {
    const message = await options.parseApiError(response);
    throw new LocalAioBatchError(message, response.status);
  }

  const headerBatchId = response.headers.get('X-Koma-Batch-Id')?.trim() || null;
  let report: PipelineBatchReport;
  let zipEntries: Readonly<Record<string, Uint8Array>> | null = null;

  if (options.aioSteps.cleanImage) {
    let entries: Record<string, Uint8Array>;
    try {
      entries = unzipSync(new Uint8Array(await response.arrayBuffer()));
    } catch {
      throw new LocalAioBatchError(
        'The batch archive could not be read.',
        response.status,
      );
    }
    report = readZipReport(entries, response.status);
    zipEntries = entries;
  } else {
    const payload = await readJsonBody(
      response,
      'The batch response is not valid JSON.',
    );
    report = parsePipelineBatchReport(payload);
  }

  const results = mapBatchReportToAioResults({
    report,
    images,
    zipEntries,
    aioSteps: options.aioSteps,
    targetLanguage: options.targetLanguage,
    renderDefaultStyle: options.renderDefaultStyle,
    applyDetectedGradientToStyle: options.applyDetectedGradientToStyle,
    minRegionSize: options.minRegionSize,
    maxAreaRatio: options.maxAreaRatio,
    cleanFileName: options.cleanFileName,
  });

  const total = Math.max(report.total_images, report.results.length);
  onProgress?.(results.length, total);

  return {
    batchId: headerBatchId ?? (report.batch_id?.trim() || batchId),
    report,
    results,
    zipEntries,
  };
}

/**
 * Run every image through `/pipeline/batch`, one sequential chunk of at most
 * `LOCAL_AIO_BATCH_CHUNK_SIZE` images at a time. Chunk N+1 never starts before
 * chunk N resolves; each chunk's poller starts before its request and is
 * stopped in `finally`, so no timer survives a chunk (or an abort/unmount).
 */
export async function runLocalAioBatchChunks({
  localApiUrl,
  images,
  options,
  capacity,
  signal,
  onProgress,
  onChunkState,
}: RunLocalAioBatchChunksInput): Promise<LocalAioBatchChunksResult> {
  const total = images.length;
  const results: AioBatchImageResult[] = [];
  const batchIds: string[] = [];

  if (total === 0) {
    return { batchIds, results };
  }

  const chunkCount = Math.ceil(total / LOCAL_AIO_BATCH_CHUNK_SIZE);

  for (let chunkNumber = 1; chunkNumber <= chunkCount; chunkNumber += 1) {
    if (signal.aborted) {
      throw createAioAbortError();
    }

    const offset = (chunkNumber - 1) * LOCAL_AIO_BATCH_CHUNK_SIZE;
    const chunk = images.slice(offset, offset + LOCAL_AIO_BATCH_CHUNK_SIZE);
    const batchId = createBatchId();
    batchIds.push(batchId);
    onChunkState?.(chunkNumber, chunkCount, chunk[0]?.file.name ?? '');

    const stopPolling = startBatchProgressPolling({
      localApiUrl,
      batchId,
      signal,
      onUpdate: (progress) => {
        onProgress?.(Math.min(total, offset + progress.completed), total);
        if (progress.currentName.length > 0) {
          onChunkState?.(chunkNumber, chunkCount, progress.currentName);
        }
      },
    });

    try {
      const chunkResult = await runLocalAioBatch({
        localApiUrl,
        images: chunk,
        options,
        capacity,
        signal,
        batchId,
      });
      results.push(...chunkResult.results);
      onProgress?.(Math.min(total, offset + chunk.length), total);
    } finally {
      stopPolling();
    }
  }

  return { batchIds, results };
}
