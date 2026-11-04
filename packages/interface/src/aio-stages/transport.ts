/** Shared stage-run transport: one form POST → finished run (or throw). */
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
    // Read the busy signal from a clone first: parseApiError consumes the body.
    const isBusy = await isStageBusyResponse(response);
    const apiMessage = await options.parseApiError(response);
    const message =
      options.formatError?.(apiMessage) ?? `${options.failurePrefix}: ${apiMessage}`;
    throw isBusy
      ? new StageBusyError(message, notice)
      : new StageTransportError(message, notice);
  }
  return { value: await spec.parse(response), response, notice };
}
