const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_RETRY_DELAY_MS = 300;
const DEFAULT_RETRY_COUNT = 1;

const MAX_TIMER_MS = 2_147_483_647;
const MAX_RETRY_COUNT = 5;
const MAX_RETRY_DELAY_MS = 30_000;

const RETRYABLE_METHODS: ReadonlySet<string> = new Set([
  "GET",
  "HEAD",
  "OPTIONS",
]);

const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([
  408,
  429,
  500,
  502,
  503,
  504,
]);

export interface FetchJsonOptions {
  readonly timeoutMs?: number;
  readonly retryCount?: number;
  readonly retryDelayMs?: number;
  readonly signal?: AbortSignal;
}

export interface FetchJsonResult<TPayload = unknown> {
  readonly response: Response;
  readonly payload: TPayload | null;
}

export type ResponseReader<TPayload> = (
  response: Response,
  signal: AbortSignal,
) => Promise<TPayload>;

interface NormalizedOptions {
  readonly timeoutMs: number;
  readonly retryCount: number;
  readonly retryDelayMs: number;
}

interface AbortScope {
  readonly signal: AbortSignal;
  readonly dispose: () => void;
}

type AttemptResult<TPayload> =
  | Readonly<{ kind: "complete"; value: TPayload }>
  | Readonly<{ kind: "retry"; delayMs: number }>;

export class HttpTimeoutError extends Error {
  public readonly timeoutMs: number;

  public constructor(timeoutMs: number) {
    super(`The HTTP operation exceeded ${timeoutMs} ms.`);
    this.name = "TimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

const boundedInteger = (
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  name: string,
): number => {
  const resolved = value ?? fallback;

  if (
    !Number.isSafeInteger(resolved) ||
    resolved < minimum ||
    resolved > maximum
  ) {
    throw new RangeError(
      `${name} must be an integer between ${minimum} and ${maximum}.`,
    );
  }

  return resolved;
};

const normalizeOptions = (
  options: FetchJsonOptions,
): NormalizedOptions => ({
  timeoutMs: boundedInteger(
    options.timeoutMs,
    DEFAULT_TIMEOUT_MS,
    1,
    MAX_TIMER_MS,
    "timeoutMs",
  ),
  retryCount: boundedInteger(
    options.retryCount,
    DEFAULT_RETRY_COUNT,
    0,
    MAX_RETRY_COUNT,
    "retryCount",
  ),
  retryDelayMs: boundedInteger(
    options.retryDelayMs,
    DEFAULT_RETRY_DELAY_MS,
    0,
    MAX_RETRY_DELAY_MS,
    "retryDelayMs",
  ),
});

const createAbortScope = (
  sources: ReadonlyArray<AbortSignal | null | undefined>,
  timeoutMs?: number,
): AbortScope => {
  const controller = new AbortController();
  const cleanups: Array<() => void> = [];

  for (const source of new Set(sources)) {
    if (source == null) {
      continue;
    }

    if (source.aborted) {
      controller.abort(source.reason);
      break;
    }

    const onAbort = (): void => {
      controller.abort(source.reason);
    };

    source.addEventListener("abort", onAbort, { once: true });
    cleanups.push(() => source.removeEventListener("abort", onAbort));
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;

  if (!controller.signal.aborted && timeoutMs !== undefined) {
    timeout = setTimeout(() => {
      controller.abort(new HttpTimeoutError(timeoutMs));
    }, timeoutMs);
  }

  return {
    signal: controller.signal,
    dispose: (): void => {
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }

      for (const cleanup of cleanups) {
        cleanup();
      }
    },
  };
};

const abortableDelay = (
  delayMs: number,
  signal: AbortSignal,
): Promise<void> => {
  signal.throwIfAborted();

  return new Promise<void>((resolve, reject) => {
    const cleanup = (): void => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
    };

    const onAbort = (): void => {
      cleanup();
      reject(signal.reason);
    };

    const timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, delayMs);

    signal.addEventListener("abort", onAbort, { once: true });
  });
};

const getRetryDelay = (
  response: Response,
  attempt: number,
  retryDelayMs: number,
): number | null => {
  const backoff = Math.min(
    MAX_RETRY_DELAY_MS,
    retryDelayMs * 2 ** attempt,
  );

  const retryAfter = response.headers.get("Retry-After")?.trim();

  if (!retryAfter) {
    return backoff;
  }

  let requestedDelay: number;

  if (/^\d+$/.test(retryAfter)) {
    requestedDelay = Number(retryAfter) * 1_000;
  } else {
    const timestamp = Date.parse(retryAfter);

    if (!Number.isFinite(timestamp)) {
      return backoff;
    }

    requestedDelay = Math.max(0, timestamp - Date.now());
  }

  // Não repetimos antes do prazo do servidor nem esperamos sem limite.
  if (
    !Number.isFinite(requestedDelay) ||
    requestedDelay > MAX_RETRY_DELAY_MS
  ) {
    return null;
  }

  return Math.max(backoff, requestedDelay);
};

const cancelResponseBody = async (response: Response): Promise<void> => {
  if (response.body === null || response.body.locked) {
    return;
  }

  await response.body.cancel().catch(() => undefined);
};

const performAttempt = async <TPayload>(
  url: string,
  init: RequestInit,
  operationSignal: AbortSignal,
  options: NormalizedOptions,
  attempt: number,
  read: ResponseReader<TPayload>,
): Promise<AttemptResult<TPayload>> => {
  const scope = createAbortScope([operationSignal], options.timeoutMs);
  let response: Response | undefined;

  try {
    scope.signal.throwIfAborted();

    try {
      response = await fetch(url, {
        ...init,
        headers: new Headers(init.headers),
        signal: scope.signal,
      });
    } catch (error: unknown) {
      operationSignal.throwIfAborted();

      const failure: unknown = scope.signal.aborted
        ? scope.signal.reason
        : error;

      if (
        attempt < options.retryCount &&
        (failure instanceof TypeError ||
          failure instanceof HttpTimeoutError)
      ) {
        return {
          kind: "retry",
          delayMs: Math.min(
            MAX_RETRY_DELAY_MS,
            options.retryDelayMs * 2 ** attempt,
          ),
        };
      }

      throw failure;
    }

    scope.signal.throwIfAborted();

    if (
      attempt < options.retryCount &&
      RETRYABLE_STATUSES.has(response.status)
    ) {
      const delayMs = getRetryDelay(
        response,
        attempt,
        options.retryDelayMs,
      );

      if (delayMs !== null) {
        await cancelResponseBody(response);
        scope.signal.throwIfAborted();

        return { kind: "retry", delayMs };
      }
    }

    const value = await read(response, scope.signal);
    scope.signal.throwIfAborted();

    return { kind: "complete", value };
  } catch (error: unknown) {
    if (response !== undefined) {
      await cancelResponseBody(response);
    }

    if (scope.signal.aborted) {
      throw scope.signal.reason;
    }

    throw error;
  } finally {
    scope.dispose();
  }
};

const request = async <TPayload>(
  url: string,
  init: RequestInit,
  options: FetchJsonOptions,
  read: ResponseReader<TPayload>,
): Promise<TPayload> => {
  const normalized = normalizeOptions(options);
  const method = (init.method ?? "GET").trim().toUpperCase() || "GET";

  const effectiveOptions: NormalizedOptions = {
    ...normalized,
    retryCount:
      RETRYABLE_METHODS.has(method) && init.body == null
        ? normalized.retryCount
        : 0,
  };

  const operation = createAbortScope([init.signal, options.signal]);

  try {
    operation.signal.throwIfAborted();

    for (
      let attempt = 0;
      attempt <= effectiveOptions.retryCount;
      attempt += 1
    ) {
      const result = await performAttempt(
        url,
        { ...init, method },
        operation.signal,
        effectiveOptions,
        attempt,
        read,
      );

      if (result.kind === "complete") {
        return result.value;
      }

      await abortableDelay(result.delayMs, operation.signal);
    }

    throw new Error("The HTTP retry state is inconsistent.");
  } finally {
    operation.dispose();
  }
};

export const fetchWithTimeoutAndRetry = (
  url: string,
  init: RequestInit = {},
  options: FetchJsonOptions = {},
): Promise<Response> =>
  request(url, init, options, (response) => Promise.resolve(response));

export const fetchAndReadWithTimeoutAndRetry = <TPayload>(
  url: string,
  read: ResponseReader<TPayload>,
  init: RequestInit = {},
  options: FetchJsonOptions = {},
): Promise<TPayload> => request(url, init, options, read);
