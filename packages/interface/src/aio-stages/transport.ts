import type { AioStageKey } from '@/types/aioModelPresets';
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
  aioAi: 300_000,
  sfxClassify: 180_000,
} as const;

export interface StageRunOptions {
  stageLabel: string;
  failurePrefix: string;
  parseApiError: (response: Response) => Promise<string>;
  formatError?: (apiMessage: string) => string;
}

export class StageTransportError extends Error {
  readonly notice: StageRunNotice | null;

  constructor(message: string, notice: StageRunNotice | null) {
    super(message);
    this.name = 'StageTransportError';
    this.notice = notice;
  }
}

export function stageTransportNoticeDetail(error: unknown): string {
  return error instanceof StageTransportError && error.notice
    ? ` ${error.notice.detail}`
    : '';
}

export const STAGE_BUSY_HTTP_STATUS = 503;

export const STAGE_BUSY_WIRE_CODE = 'INFERENCE_BUSY';

interface StageBusyDetailBody {
  code?: unknown;
  stage?: unknown;
  model_key?: unknown;
  available_keys?: unknown;
}

interface StageBusyResponseBody {
  detail?: StageBusyDetailBody | string | null;
}

const isStageBusyResponseBody = (
  value: unknown,
): value is StageBusyResponseBody =>
  typeof value === 'object' && value !== null;

async function readResponseJson(response: Response): Promise<unknown> {
  try {
    return await response.clone().json();
  } catch {
    return null;
  }
}

async function readRefusalDetail(
  response: Response,
): Promise<StageBusyDetailBody | string | null | undefined> {
  const payload: unknown = await readResponseJson(response);
  return isStageBusyResponseBody(payload) ? payload.detail : null;
}

export class StageBusyError extends StageTransportError {
  constructor(message: string, notice: StageRunNotice | null) {
    super(message, notice);
    this.name = 'StageBusyError';
  }
}

async function isStageBusyResponse(response: Response): Promise<boolean> {
  if (response.status !== STAGE_BUSY_HTTP_STATUS) {
    return false;
  }
  const detail = await readRefusalDetail(response);
  return (
    typeof detail === 'object' &&
    detail !== null &&
    detail.code === STAGE_BUSY_WIRE_CODE
  );
}

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

function parseStageModelRefusal(
  detail: StageBusyDetailBody | string | null | undefined,
): StageModelRefusalDetail | null {
  if (typeof detail !== 'object' || detail === null) {
    return null;
  }
  const wireCode = STAGE_MODEL_REFUSAL_WIRE_CODES.find(
    (candidate) => candidate === detail.code,
  );
  if (wireCode === undefined) {
    return null;
  }
  const stage = typeof detail.stage === 'string' ? detail.stage : '';
  const modelKey = typeof detail.model_key === 'string' ? detail.model_key : '';
  const availableKeys = Array.isArray(detail.available_keys)
    ? detail.available_keys.filter(
        (key): key is string => typeof key === 'string',
      )
    : [];
  return { code: wireCode, stage, modelKey, availableKeys };
}

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
