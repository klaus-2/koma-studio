/** Shared stage-run transport: one form POST → finished run (or throw). */
import { readExecutionRuntimeNotice } from '../utils/dashboard.utils';
import { fetchWithTimeoutAndRetry } from '../utils/http';
import type { FinishedStageRun, StageRunNotice, StageRuntime } from './types';

export const STAGE_TIMEOUT_MS = {
  detectText: 90_000,
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
  const notice = (await readExecutionRuntimeNotice(
    response,
    options.stageLabel,
  )) as StageRunNotice | null;
  if (!response.ok) {
    const apiMessage = await options.parseApiError(response);
    throw new Error(
      options.formatError?.(apiMessage) ?? `${options.failurePrefix}: ${apiMessage}`,
    );
  }
  return { value: await spec.parse(response), response, notice };
}
