import { beforeEach, describe, expect, it, vi } from 'vitest';

import { readExecutionRuntimeNotice } from '../utils/dashboard.utils';
import { fetchWithTimeoutAndRetry } from '../utils/http';
import { runStageForm, StageTransportError } from './transport';

vi.mock('../utils/dashboard.utils', () => ({
  readExecutionRuntimeNotice: vi.fn(),
}));
vi.mock('../utils/http', () => ({
  fetchWithTimeoutAndRetry: vi.fn(),
}));

const mockedFetchWithTimeoutAndRetry = vi.mocked(fetchWithTimeoutAndRetry);
const mockedReadExecutionRuntimeNotice = vi.mocked(readExecutionRuntimeNotice);

const runtime = { localApiUrl: 'http://127.0.0.1:8765' };

const options = {
  stageLabel: 'Recognize Text',
  failurePrefix: 'Failed to recognize text',
  parseApiError: vi.fn<(response: Response) => Promise<string>>(async () => 'backend exploded'),
};

const spec = {
  path: '/ocr',
  form: new FormData(),
  timeoutMs: 1_000,
  parse: vi.fn<(response: Response) => Promise<string>>(async () => 'parsed-value'),
};

const notice = {
  title: 'GPU fallback',
  detail: 'Model "auto" fell back to CPU due to insufficient VRAM.',
  tone: 'fallback' as const,
};

describe('runStageForm transport error contract', () => {
  beforeEach(() => {
    mockedFetchWithTimeoutAndRetry.mockReset();
    mockedReadExecutionRuntimeNotice.mockReset();
    options.parseApiError.mockClear();
    spec.parse.mockClear();
  });

  it('throws StageTransportError carrying the runtime notice when the response is not ok', async () => {
    const response = new Response('{"error":"boom"}', { status: 500 });
    mockedFetchWithTimeoutAndRetry.mockResolvedValue(response);
    mockedReadExecutionRuntimeNotice.mockResolvedValue(notice);

    const failing = runStageForm(runtime, options, spec);

    await expect(failing).rejects.toBeInstanceOf(StageTransportError);
    await expect(failing).rejects.toMatchObject({
      message: 'Failed to recognize text: backend exploded',
      notice,
    });
  });

  it('formatError still wins for the thrown message', async () => {
    const response = new Response('{"error":"boom"}', { status: 502 });
    mockedFetchWithTimeoutAndRetry.mockResolvedValue(response);
    mockedReadExecutionRuntimeNotice.mockResolvedValue(notice);

    const failing = runStageForm(
      runtime,
      { ...options, formatError: (apiMessage: string) => `FORMATTED ${apiMessage}` },
      spec,
    );

    await expect(failing).rejects.toBeInstanceOf(StageTransportError);
    await expect(failing).rejects.toMatchObject({
      message: 'FORMATTED backend exploded',
      notice,
    });
  });

  it('does not throw on an ok response and returns the notice in the finished run', async () => {
    const response = new Response('{"ok":true}', { status: 200 });
    mockedFetchWithTimeoutAndRetry.mockResolvedValue(response);
    mockedReadExecutionRuntimeNotice.mockResolvedValue(notice);

    const result = await runStageForm(runtime, options, spec);

    expect(result.value).toBe('parsed-value');
    expect(result.response).toBe(response);
    expect(result.notice).toEqual(notice);
  });

  it('carries a null notice when the failed response has no runtime notice', async () => {
    const response = new Response('{"error":"boom"}', { status: 500 });
    mockedFetchWithTimeoutAndRetry.mockResolvedValue(response);
    mockedReadExecutionRuntimeNotice.mockResolvedValue(null);

    const failing = runStageForm(runtime, options, spec);

    await expect(failing).rejects.toBeInstanceOf(StageTransportError);
    await expect(failing).rejects.toMatchObject({
      message: 'Failed to recognize text: backend exploded',
      notice: null,
    });
  });
});
