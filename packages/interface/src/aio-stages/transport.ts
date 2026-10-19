/** Shared stage-run transport helpers. */
import { fetchWithTimeoutAndRetry } from '../utils/http';
import { readExecutionRuntimeNotice } from '../utils/dashboard.utils';
import type { StageRunResult, StageRuntime } from './types';

export const STAGE_TIMEOUT_MS = {
  detectText: 90_000,
  recognizeText: 480_000,
  getTranslations: 120_000,
  segmentText: 120_000,
  cleanImage: 180_000,
} as const;

export async function postStageForm(
  runtime: StageRuntime,
  path: string,
  form: FormData,
  timeoutMs: number,
  failurePrefix: string,
): Promise<StageRunResult<Response>> {
  const response = await fetchWithTimeoutAndRetry(
    `${runtime.localApiUrl}${path}`,
    { method: 'POST', body: form },
    { timeoutMs, retryCount: 0, signal: runtime.signal ?? undefined },
  );
  if (!response.ok) {
    return { ok: false, response, error: new Error(failurePrefix) };
  }
  return { ok: true, response, value: response };
}

export interface StageRunNotice {
  title: string;
  detail: string;
  tone: 'fallback' | 'legacy';
}

export interface FinishedStageRun<T> {
  value: T;
  response: Response;
  notice: StageRunNotice | null;
}

/**
 * Read runtime notices, then either throw a formatted failure or hand back the
 * stage value. Callers stop re-implementing notice/parse ordering.
 */
export async function finishStageRun<T>(
  result: StageRunResult<T>,
  options: {
    stageLabel: string;
    failurePrefix: string;
    parseApiError: (response: Response) => Promise<string>;
  },
): Promise<FinishedStageRun<T>> {
  const notice = (await readExecutionRuntimeNotice(
    result.response,
    options.stageLabel,
  )) as StageRunNotice | null;
  if (!result.ok) {
    const apiMessage = await options.parseApiError(result.response);
    throw new Error(`${options.failurePrefix}: ${apiMessage}`);
  }
  return { value: result.value, response: result.response, notice };
}
