const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_RETRY_DELAY_MS = 300;
const DEFAULT_RETRY_COUNT = 1;

const RETRYABLE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const normalizeMethod = (method: string | undefined): string =>
  (method ?? "GET").trim().toUpperCase() || "GET";

const cloneHeaders = (headers: HeadersInit | undefined): HeadersInit | undefined => {
  if (!headers) {
    return undefined;
  }

  return new Headers(headers);
};

const cloneRequestInit = (init: RequestInit): RequestInit => ({
  ...init,
  headers: cloneHeaders(init.headers),
});

export interface FetchJsonOptions {
  timeoutMs?: number;
  retryCount?: number;
  retryDelayMs?: number;
  signal?: AbortSignal;
}

export interface FetchJsonResult<TPayload = unknown> {
  response: Response;
  payload: TPayload | null;
}

export const fetchWithTimeoutAndRetry = async (
  url: string,
  init: RequestInit = {},
  options: FetchJsonOptions = {},
): Promise<Response> => {
  const timeoutMs = Math.max(1_000, Math.trunc(options.timeoutMs ?? DEFAULT_TIMEOUT_MS));
  const retryDelayMs = Math.max(100, Math.trunc(options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS));
  const method = normalizeMethod(init.method);
  const requestedRetryCount = Math.max(0, Math.trunc(options.retryCount ?? DEFAULT_RETRY_COUNT));
  const retryCount = RETRYABLE_METHODS.has(method) ? requestedRetryCount : 0;
  const externalSignal = options.signal;

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    if (externalSignal?.aborted) {
      throw externalSignal.reason instanceof Error
        ? externalSignal.reason
        : new DOMException("The operation was aborted.", "AbortError");
    }

    const controller = new AbortController();
    let timedOut = false;
    const abortFromExternalSignal = (): void => {
      controller.abort(
        externalSignal?.reason instanceof Error
          ? externalSignal.reason
          : new DOMException("The operation was aborted.", "AbortError"),
      );
    };
    if (externalSignal) {
      externalSignal.addEventListener("abort", abortFromExternalSignal, { once: true });
    }
    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      controller.abort(
        new DOMException(
          `The request timed out after ${Math.round(timeoutMs / 1000)}s.`,
          "TimeoutError",
        ),
      );
    }, timeoutMs);

    try {
      const response = await fetch(url, {
        ...cloneRequestInit(init),
        signal: controller.signal,
      });

      const shouldRetry =
        attempt < retryCount &&
        RETRYABLE_METHODS.has(method) &&
        RETRYABLE_STATUSES.has(response.status);
      if (shouldRetry) {
        await delay(retryDelayMs * (attempt + 1));
        continue;
      }

      return response;
    } catch (error) {
      lastError = timedOut
        ? new DOMException(
          `The request timed out after ${Math.round(timeoutMs / 1000)}s.`,
          "TimeoutError",
        )
        : error;
      const shouldRetry = attempt < retryCount && RETRYABLE_METHODS.has(method);
      if (shouldRetry) {
        await delay(retryDelayMs * (attempt + 1));
        continue;
      }
    } finally {
      clearTimeout(timeoutHandle);
      if (externalSignal) {
        externalSignal.removeEventListener("abort", abortFromExternalSignal);
      }
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error("HTTP request failed.");
};
