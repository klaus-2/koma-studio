import { act, renderHook } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { strToU8, zipSync } from "fflate";

const { fetchWithTimeoutAndRetryMock } = vi.hoisted(() => ({
  fetchWithTimeoutAndRetryMock: vi.fn<
    typeof import("../../../utils/http")["fetchWithTimeoutAndRetry"]
  >(),
}));

vi.mock("../../../utils/http", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../../../utils/http")
  >()),
  fetchWithTimeoutAndRetry: fetchWithTimeoutAndRetryMock,
}));

vi.mock("../../../utils/dashboard.utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../utils/dashboard.utils")>()),
  loadImageFromSource: vi.fn(async () => {
    const image = new Image();
    image.width = 8;
    image.height = 8;
    return image;
  }),
}));

vi.mock("../../../utils/imagePerformance", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../utils/imagePerformance")>()),
  createThumbnailFromUrl: vi.fn(async () => "blob:thumbnail"),
}));

import { useDashboardUploads } from "./image-collection";

const pngBytes = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const ingestResponseZip = (): Uint8Array =>
  zipSync({
    "manifest.json": strToU8(
      JSON.stringify({
        items: [{ path: "001.png", source_file: "chapter.cb7", mime_type: "image/png" }],
      }),
    ),
    "001.png": pngBytes,
  });

const containerFile = (): File =>
  new File([pngBytes], "chapter.cb7", { type: "application/x-7z-compressed" });

// A fresh ArrayBuffer-backed copy: Response bodies require BufferSource over
// ArrayBuffer, and zipSync's Uint8Array is ArrayBufferLike-typed.
const ingestResponseBody = (): Uint8Array<ArrayBuffer> =>
  new Uint8Array(ingestResponseZip());

describe("useDashboardUploads warmup fire-and-forget", () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeAll(() => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(() => "blob:page"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  });

  afterAll(() => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: originalRevokeObjectURL,
    });
  });

  beforeEach(() => {
    fetchWithTimeoutAndRetryMock.mockReset();
  });

  it("fires exactly one warmup POST with the exact payload after a successful ingest", async () => {
    fetchWithTimeoutAndRetryMock.mockImplementation(async (url: string | URL) => {
      if (String(url).endsWith("/ingest/images")) {
        return new Response(ingestResponseBody());
      }
      return new Response(null, { status: 200 });
    });
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const { result } = renderHook(() =>
      useDashboardUploads({
        localApiUrl: "http://127.0.0.1:8001",
        setStatusMessage: () => undefined,
        invalidateAioPipelineHistory: () => undefined,
        warmupPayload: { language: "ja", ocrModelKey: "manga_ocr" },
      }),
    );

    await act(async () => {
      await result.current.onDrop([containerFile()]);
    });

    const warmupCalls = fetchWithTimeoutAndRetryMock.mock.calls.filter(
      ([url]) => String(url).endsWith("/warmup"),
    );
    expect(warmupCalls).toHaveLength(1);
    const [warmupCall] = warmupCalls;
    if (!warmupCall) {
      throw new Error("the warmup call must be captured");
    }
    const [url, init = {}, options] = warmupCall;
    expect(url).toBe("http://127.0.0.1:8001/warmup");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(init.body).toBe(
      JSON.stringify({ language: "ja", ocr_model_key: "manga_ocr" }),
    );
    expect(options).toEqual({ timeoutMs: 10_000, retryCount: 0 });
    debugSpy.mockRestore();
  });

  it("does not POST when the warmup payload is null", async () => {
    fetchWithTimeoutAndRetryMock.mockImplementation(async (url: string | URL) => {
      if (String(url).endsWith("/ingest/images")) {
        return new Response(ingestResponseBody());
      }
      return new Response(null, { status: 200 });
    });
    const { result } = renderHook(() =>
      useDashboardUploads({
        localApiUrl: "http://127.0.0.1:8001",
        setStatusMessage: () => undefined,
        invalidateAioPipelineHistory: () => undefined,
        warmupPayload: null,
      }),
    );

    await act(async () => {
      await result.current.onDrop([containerFile()]);
    });

    expect(
      fetchWithTimeoutAndRetryMock.mock.calls.filter(([url]) =>
        String(url).endsWith("/warmup"),
      ),
    ).toHaveLength(0);
  });

  it("swallows the fetch rejection with a debug log", async () => {
    fetchWithTimeoutAndRetryMock.mockImplementation(async (url: string | URL) => {
      if (String(url).endsWith("/ingest/images")) {
        return new Response(ingestResponseBody());
      }
      throw new Error("warmup endpoint unavailable");
    });
    const debugSpy = vi
      .spyOn(console, "debug")
      .mockImplementation(() => undefined);
    const { result } = renderHook(() =>
      useDashboardUploads({
        localApiUrl: "http://127.0.0.1:8001",
        setStatusMessage: () => undefined,
        invalidateAioPipelineHistory: () => undefined,
        warmupPayload: { language: "ja", ocrModelKey: "manga_ocr" },
      }),
    );

    await act(async () => {
      await result.current.onDrop([containerFile()]);
    });

    expect(
      fetchWithTimeoutAndRetryMock.mock.calls.filter(([url]) =>
        String(url).endsWith("/warmup"),
      ),
    ).toHaveLength(1);
    expect(debugSpy).toHaveBeenCalled();
    debugSpy.mockRestore();
  });
});
