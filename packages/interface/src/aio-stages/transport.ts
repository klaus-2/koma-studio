/** Shared stage-run transport: one form POST → finished run (or throw). */
import type { AioStageKey } from '@/types/aioModelPresets';
import { readExecutionRuntimeNotice } from '../utils/dashboard.utils';
import { fetchWithTimeoutAndRetry } from '../utils/http';
import type { FinishedStageRun, StageRunNotice, StageRuntime } from './types';

export const STAGE_TIMEOUT_MS = {
  detectText: 90_000,
  // 480 s on purpose: the assisted Cleaner used to allow only 90 s for OCR —
  // unified with the AIO recognizeText budget deliberately.
  // Do not split back into a per-caller timeout.
  recognizeText: 480_000,
  getTranslations: 120_000,
  segmentText: 120_000,
  cleanImage: 180_000,
  cleanImageAi: 240_000,
  sfxClassify: 180_000,
} as const;

export interface StageRunOptions {
  stageLabel: string;
  failurePrefix: string;
  parseApiError: (response: Response) => Promise<string>;
  /** Replaces `` `${failurePrefix}: ${apiMessage}` `` when the caller owns the copy. */
  formatError?: (apiMessage: string) => string;
}

/**
 * Transport failure carrying the backend runtime notice (e.g. the
 * INSUFFICIENT_VRAM / `X-Koma-Execution-Fallback: gpu_oom_to_cpu`
 * explanation). Without it the notice parsed from a failed response would be
 * discarded and never reach the user.
 */
export class StageTransportError extends Error {
  readonly notice: StageRunNotice | null;

  constructor(message: string, notice: StageRunNotice | null) {
    super(message);
    this.name = 'StageTransportError';
    this.notice = notice;
  }
}

/**
 * Message suffix for a caught transport failure when the backend attached a
 * runtime notice (e.g. the GPU OOM fallback) — surfaces the notice next to
 * the transport failure text.
 */
export function stageTransportNoticeDetail(error: unknown): string {
  return error instanceof StageTransportError && error.notice
    ? ` ${error.notice.detail}`
    : '';
}

/** HTTP status the sidecar answers with when the admission pool is saturated. */
export const STAGE_BUSY_HTTP_STATUS = 503;

/** Body code distinguishing "model busy — retry" from generic runtime failures. */
export const STAGE_BUSY_WIRE_CODE = 'INFERENCE_BUSY';

interface StageBusyDetailBody {
  code?: string;
}

interface StageBusyResponseBody {
  detail?: StageBusyDetailBody | string | null;
}

/** Reads the parsed `detail` object from a failed response (null when absent). */
async function readRefusalDetail(
  response: Response,
): Promise<StageBusyDetailBody | string | null | undefined> {
  const payload = (await response.clone().json().catch(() => null)) as
    | StageBusyResponseBody
    | null;
  return payload?.detail;
}

/**
 * Named, retryable failure: the shared inference admission pool is saturated,
 * so the stage call was refused instead of queued. Surfaces as the "model
 * busy — retry" state on the per-item error display instead of a raw error.
 */
export class StageBusyError extends StageTransportError {
  constructor(message: string, notice: StageRunNotice | null) {
    super(message, notice);
    this.name = 'StageBusyError';
  }
}

/** Defensive read of the busy wire signal (503 + `detail.code`). */
async function isStageBusyResponse(response: Response): Promise<boolean> {
  if (response.status !== STAGE_BUSY_HTTP_STATUS) {
    return false;
  }
  const payload = (await response.clone().json().catch(() => null)) as
    | StageBusyResponseBody
    | null;
  const detail = payload?.detail;
  return (
    typeof detail === 'object' &&
    detail !== null &&
    detail.code === STAGE_BUSY_WIRE_CODE
  );
}

/** Wire codes the backend answers with for explicit model-selection refusals (HTTP 400). */
export const STAGE_MODEL_REFUSAL_WIRE_CODES = [
  'MODEL_NOT_IMPLEMENTED',
  'UNKNOWN_MODEL',
  'MODEL_NOT_CONFIGURED',
] as const;

export type StageModelRefusalWireCode = (typeof STAGE_MODEL_REFUSAL_WIRE_CODES)[number];

export interface StageModelRefusalDetail {
  code: StageModelRefusalWireCode;
  stage: string;
  modelKey: string;
  availableKeys: readonly string[];
}

interface StageRefusalDetailBody {
  code?: unknown;
  stage?: unknown;
  model_key?: unknown;
  available_keys?: unknown;
}

/**
 * Defensive read of the structured refusal body
 * (`{error, code, stage, model_key, available_keys}`); returns null for any
 * other error shape so generic failures keep their plain message.
 */
function parseStageModelRefusal(
  detail: StageBusyDetailBody | string | null | undefined,
): StageModelRefusalDetail | null {
  if (typeof detail !== 'object' || detail === null) {
    return null;
  }
  const body = detail as StageRefusalDetailBody;
  const code = body.code;
  const wireCode = STAGE_MODEL_REFUSAL_WIRE_CODES.find(
    (candidate) => candidate === code,
  );
  if (wireCode === undefined) {
    return null;
  }
  const stage = typeof body.stage === 'string' ? body.stage : '';
  const modelKey = typeof body.model_key === 'string' ? body.model_key : '';
  const availableKeys = Array.isArray(body.available_keys)
    ? body.available_keys.filter(
        (key): key is string => typeof key === 'string',
      )
    : [];
  return { code: wireCode, stage, modelKey, availableKeys };
}

/**
 * Named refusal: an explicitly selected model cannot serve the request
 * (unimplemented engine, unknown key, or missing configuration). Surfaces as
 * the "use the default model" warning next to the stage picker instead of a
 * raw 400 message.
 */
export class StageModelRefusalError extends StageTransportError {
  readonly refusal: StageModelRefusalDetail;

  constructor(
    message: string,
    notice: StageRunNotice | null,
    refusal: StageModelRefusalDetail,
  ) {
    super(message, notice);
    this.name = 'StageModelRefusalError';
    this.refusal = refusal;
  }
}

/** Maps a wire stage name from a refusal body to the UI stage key. */
export function stageKeyForRefusalStage(stage: string): AioStageKey | null {
  switch (stage) {
    case 'detect':
      return 'detectText';
    case 'segment':
      return 'segmentText';
    case 'translate':
      return 'getTranslations';
    default:
      return null;
  }
}

/**
 * POST a stage form, read runtime notices, then either throw a formatted
 * failure or hand back the parsed stage value.
 */
export async function runStageForm<T>(
  runtime: StageRuntime,
  options: StageRunOptions,
  spec: {
    path: string;
    form: FormData;
    timeoutMs: number;
    parse: (response: Response) => Promise<T>;
  },
): Promise<FinishedStageRun<T>> {
  const response = await fetchWithTimeoutAndRetry(
    `${runtime.localApiUrl}${spec.path}`,
    { method: 'POST', body: spec.form },
    { timeoutMs: spec.timeoutMs, retryCount: 0, signal: runtime.signal ?? undefined },
  );
  const notice = await readExecutionRuntimeNotice(
    response,
    options.stageLabel,
  );
  if (!response.ok) {
    // Read the busy/refusal signals from a clone first: parseApiError consumes the body.
    const isBusy = await isStageBusyResponse(response);
    const refusal = isBusy
      ? null
      : parseStageModelRefusal(await readRefusalDetail(response));
    const apiMessage = await options.parseApiError(response);
    const message =
      options.formatError?.(apiMessage) ?? `${options.failurePrefix}: ${apiMessage}`;
    if (refusal !== null) {
      throw new StageModelRefusalError(message, notice, refusal);
    }
    throw isBusy
      ? new StageBusyError(message, notice)
      : new StageTransportError(message, notice);
  }
  return { value: await spec.parse(response), response, notice };
}
