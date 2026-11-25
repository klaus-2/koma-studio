import type { PipelineBatchItemResult } from '@/types/dashboard.types';
import {
  LocalAioBatchError,
  parseBatchItemResult,
  parseBatchProgress,
  type BatchProgress,
} from './batch-wire';

const DEFAULT_POLL_INTERVAL_MS = 500;
const PROGRESS_TIMEOUT_MS = 3_000;
const MAX_CONSECUTIVE_POLL_FAILURES = 5;

export interface BatchPageStreamEvent {
  item: PipelineBatchItemResult;
  hasCleaned: boolean;
  cleanedUrl: string | null;
}

export interface StartBatchProgressStreamInput {
  localApiUrl: string;
  batchId: string;
  signal: AbortSignal;
  onUpdate: (progress: BatchProgress) => void;
  onPageResult?: (page: BatchPageStreamEvent) => void;
  onError?: (error: LocalAioBatchError) => void;
  headers?: HeadersInit;
  pollIntervalMs?: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const joinUrl = (base: string, path: string): string =>
  `${base.replace(/\/+$/, '')}${path}`;

const mergeHeaders = (
  baseHeaders: Record<string, string>,
  extraHeaders?: HeadersInit,
): Headers => {
  const merged = new Headers(extraHeaders);
  for (const [key, value] of Object.entries(baseHeaders)) {
    if (!merged.has(key)) {
      merged.set(key, value);
    }
  }
  return merged;
};

export const parseBatchPageStreamEvent = (
  payload: unknown,
  position = 0,
): BatchPageStreamEvent => {
  if (!isRecord(payload)) {
    throw new LocalAioBatchError('The batch page SSE event is not an object.');
  }
  const item = parseBatchItemResult(payload, position);
  const hasCleaned =
    typeof payload.has_cleaned === 'boolean' ? payload.has_cleaned : false;
  const rawCleanedUrl = payload.cleaned_url;
  const cleanedUrl =
    typeof rawCleanedUrl === 'string' && rawCleanedUrl.length > 0
      ? rawCleanedUrl
      : null;
  return {
    item,
    hasCleaned,
    cleanedUrl,
  };
};

const parseSseBlock = (
  rawBlock: string,
): { eventName: string; data: string } | null => {
  const lines = rawBlock.split('\n');
  let eventName = 'message';
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.length === 0 || line.startsWith(':')) {
      continue;
    }
    const colonIndex = line.indexOf(':');
    const field = colonIndex === -1 ? line : line.slice(0, colonIndex);
    const rawValue = colonIndex === -1 ? '' : line.slice(colonIndex + 1);
    const value = rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue;
    if (field === 'event') {
      eventName = value;
    } else if (field === 'data') {
      dataLines.push(value);
    }
  }

  if (dataLines.length === 0) {
    return null;
  }
  return {
    eventName,
    data: dataLines.join('\n'),
  };
};

export function startBatchProgressStream({
  localApiUrl,
  batchId,
  signal,
  onUpdate,
  onPageResult,
  onError,
  headers,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
}: StartBatchProgressStreamInput): () => void {
  let stopped = false;
  let completedDone = false;
  let fallbackStarted = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let pollInFlight = false;
  let consecutiveFailures = 0;
  let pageCount = 0;
  const streamController = new AbortController();

  const stop = (): void => {
    if (stopped) {
      return;
    }
    stopped = true;
    streamController.abort();
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    signal.removeEventListener('abort', stop);
  };

  if (signal.aborted) {
    stop();
    return stop;
  }

  signal.addEventListener('abort', stop, { once: true });

  const startFallbackPolling = (): void => {
    if (stopped || completedDone || fallbackStarted || signal.aborted) {
      return;
    }
    fallbackStarted = true;
    const progressUrl = `${joinUrl(localApiUrl, '/pipeline/batch/progress')}?batch_id=${encodeURIComponent(batchId)}`;

    const tick = async (): Promise<void> => {
      if (stopped || pollInFlight || signal.aborted) {
        return;
      }
      pollInFlight = true;
      const timeoutController = new AbortController();
      const abortPoll = (): void => {
        timeoutController.abort();
      };
      streamController.signal.addEventListener('abort', abortPoll, { once: true });
      const timeoutId = setTimeout(abortPoll, PROGRESS_TIMEOUT_MS);

      try {
        const pollHeaders = mergeHeaders({ Accept: 'application/json' }, headers);
        const response = await fetch(progressUrl, {
          method: 'GET',
          headers: pollHeaders,
          signal: timeoutController.signal,
        });
        if (response.status === 404) {
          return;
        }
        if (!response.ok) {
          throw new LocalAioBatchError(
            `HTTP ${response.status}`,
            response.status,
          );
        }
        const payload: unknown = await response.json();
        const progress = parseBatchProgress(payload, response.status);
        consecutiveFailures = 0;
        if (stopped || signal.aborted) {
          return;
        }
        onUpdate(progress);
        if (progress.finished || progress.cancelled) {
          completedDone = true;
          stop();
        }
      } catch (err: unknown) {
        if (stopped || signal.aborted) {
          return;
        }
        consecutiveFailures += 1;
        if (consecutiveFailures < MAX_CONSECUTIVE_POLL_FAILURES) {
          return;
        }
        stop();
        onError?.(
          err instanceof LocalAioBatchError
            ? err
            : new LocalAioBatchError(
                `The batch progress poll stopped after ${MAX_CONSECUTIVE_POLL_FAILURES} consecutive failures.`,
              ),
        );
      } finally {
        clearTimeout(timeoutId);
        streamController.signal.removeEventListener('abort', abortPoll);
        pollInFlight = false;
      }
    };

    pollTimer = setInterval(() => {
      void tick();
    }, pollIntervalMs);
    void tick();
  };

  const handleParsedEvent = (
    eventName: string,
    rawData: string,
    status: number,
  ): void => {
    if (stopped || signal.aborted) {
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawData);
    } catch {
      return;
    }

    if (eventName === 'page') {
      if (onPageResult !== undefined) {
        onPageResult(parseBatchPageStreamEvent(parsed, pageCount));
      }
      pageCount += 1;
      return;
    }

    if (eventName === 'done') {
      const progress = parseBatchProgress(parsed, status);
      completedDone = true;
      onUpdate(progress);
      stop();
      return;
    }

    if (eventName === 'progress' || eventName === 'message') {
      const progress = parseBatchProgress(parsed, status);
      onUpdate(progress);
      if (progress.finished || progress.cancelled) {
        completedDone = true;
        stop();
      }
    }
  };

  const runStream = async (): Promise<void> => {
    const eventsUrl = joinUrl(
      localApiUrl,
      `/pipeline/batch/${encodeURIComponent(batchId)}/events`,
    );
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

    try {
      const response = await fetch(eventsUrl, {
        method: 'GET',
        headers: mergeHeaders({ Accept: 'text/event-stream' }, headers),
        signal: streamController.signal,
      });

      if (!response.ok || response.body === null) {
        startFallbackPolling();
        return;
      }

      reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (!signal.aborted) {
        if (stopped || completedDone) {
          break;
        }
        const chunk = await reader.read();
        if (chunk.done) {
          break;
        }
        buffer += decoder
          .decode(chunk.value, { stream: true })
          .replaceAll('\r\n', '\n')
          .replaceAll('\r', '\n');

        let boundaryIndex = buffer.indexOf('\n\n');
        while (boundaryIndex !== -1) {
          const rawBlock = buffer.slice(0, boundaryIndex);
          buffer = buffer.slice(boundaryIndex + 2);
          const event = parseSseBlock(rawBlock);
          if (event !== null) {
            handleParsedEvent(event.eventName, event.data, response.status);
          }
          if (stopped || completedDone) {
            return;
          }
          boundaryIndex = buffer.indexOf('\n\n');
        }
      }

      const trailing = decoder
        .decode()
        .replaceAll('\r\n', '\n')
        .replaceAll('\r', '\n');
      if (trailing.length > 0) {
        buffer += trailing;
      }
      if (!stopped && !completedDone && buffer.trim().length > 0) {
        const event = parseSseBlock(buffer);
        if (event !== null) {
          handleParsedEvent(event.eventName, event.data, response.status);
        }
      }

      if (!stopped && !completedDone && !signal.aborted) {
        startFallbackPolling();
      }
    } catch {
      if (!stopped && !completedDone && !signal.aborted) {
        startFallbackPolling();
      }
    } finally {
      if (reader !== null) {
        await reader.cancel().catch(() => undefined);
      }
    }
  };

  void runStream();
  return stop;
}
