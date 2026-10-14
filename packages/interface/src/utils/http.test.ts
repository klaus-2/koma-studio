import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  fetchAndReadWithTimeoutAndRetry,
  fetchWithTimeoutAndRetry,
  HttpTimeoutError,
} from "@/utils/http";

const TEST_URL = "https://example.test/resource";

const createFetchMock = () => vi.fn<typeof fetch>();

describe("HTTP lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns a successful response", async () => {
    const response = new Response("ok");
    const fetchMock = createFetchMock().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchWithTimeoutAndRetry(TEST_URL)).resolves.toBe(
      response,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not retry POST requests", async () => {
    const fetchMock = createFetchMock().mockResolvedValue(
      new Response(null, { status: 503 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchWithTimeoutAndRetry(
      TEST_URL,
      { method: "POST", body: new FormData() },
      { retryCount: 3 },
    );

    expect(response.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries safe methods after transient responses", async () => {
    const first = new Response("busy", { status: 503 });
    const cancel = first.body ? vi.spyOn(first.body, "cancel") : null;
    const second = new Response("ok");

    const fetchMock = createFetchMock()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);

    vi.stubGlobal("fetch", fetchMock);

    const pending = fetchWithTimeoutAndRetry(
      TEST_URL,
      { method: " get " },
      { retryDelayMs: 300 },
    );

    await vi.advanceTimersByTimeAsync(300);

    await expect(pending).resolves.toBe(second);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(cancel).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("honors Retry-After", async () => {
    const fetchMock = createFetchMock()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 429,
          headers: { "Retry-After": "2" },
        }),
      )
      .mockResolvedValueOnce(new Response("ok"));

    vi.stubGlobal("fetch", fetchMock);

    const pending = fetchWithTimeoutAndRetry(TEST_URL);

    await vi.advanceTimersByTimeAsync(1_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await pending;

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns the response when Retry-After exceeds the wait budget", async () => {
    const response = new Response(null, {
      status: 429,
      headers: { "Retry-After": "120" },
    });

    const fetchMock = createFetchMock().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchWithTimeoutAndRetry(TEST_URL)).resolves.toBe(
      response,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("respects an already aborted RequestInit signal", async () => {
    const controller = new AbortController();
    const reason = new DOMException("Cancelled", "AbortError");
    controller.abort(reason);

    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchWithTimeoutAndRetry(TEST_URL, {
        signal: controller.signal,
      }),
    ).rejects.toBe(reason);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cancels the retry backoff without another fetch", async () => {
    const controller = new AbortController();
    const reason = new DOMException("Cancelled", "AbortError");

    const fetchMock = createFetchMock().mockResolvedValue(
      new Response(null, { status: 503 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const pending = fetchWithTimeoutAndRetry(
      TEST_URL,
      {},
      { signal: controller.signal, retryDelayMs: 1_000 },
    );
    const assertion = expect(pending).rejects.toBe(reason);

    await vi.advanceTimersByTimeAsync(0);
    controller.abort(reason);

    await assertion;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aborts a request when its deadline expires", async () => {
    const fetchMock = createFetchMock().mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;

          if (signal == null) {
            reject(new Error("Expected a request signal."));
            return;
          }

          signal.addEventListener(
            "abort",
            () => reject(signal.reason),
            { once: true },
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const pending = fetchWithTimeoutAndRetry(
      TEST_URL,
      {},
      { timeoutMs: 100, retryCount: 0 },
    );
    const assertion = expect(pending).rejects.toBeInstanceOf(
      HttpTimeoutError,
    );

    await vi.advanceTimersByTimeAsync(100);
    await assertion;

    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps the deadline active while the reader consumes the response", async () => {
    vi.stubGlobal(
      "fetch",
      createFetchMock().mockResolvedValue(new Response("ok")),
    );

    const pending = fetchAndReadWithTimeoutAndRetry(
      TEST_URL,
      (_response, signal) =>
        new Promise<never>((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () => reject(signal.reason),
            { once: true },
          );
        }),
      {},
      { timeoutMs: 100, retryCount: 0 },
    );
    const assertion = expect(pending).rejects.toBeInstanceOf(
      HttpTimeoutError,
    );

    await vi.advanceTimersByTimeAsync(100);
    await assertion;

    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not retry parsing failures", async () => {
    const fetchMock = createFetchMock().mockResolvedValue(
      new Response("{invalid-json"),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchAndReadWithTimeoutAndRetry(
        TEST_URL,
        async (response): Promise<unknown> => response.json(),
      ),
    ).rejects.toBeInstanceOf(SyntaxError);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1, 1.5])(
    "rejects an invalid timeout: %s",
    async (timeoutMs) => {
      const fetchMock = createFetchMock();
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        fetchWithTimeoutAndRetry(TEST_URL, {}, { timeoutMs }),
      ).rejects.toBeInstanceOf(RangeError);

      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
});
