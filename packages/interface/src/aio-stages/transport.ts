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
    const apiMessage = await options.parseApiError(response);
    throw new StageTransportError(
      options.formatError?.(apiMessage) ?? `${options.failurePrefix}: ${apiMessage}`,
      notice,
    );
  }
  return { value: await spec.parse(response), response, notice };
}
