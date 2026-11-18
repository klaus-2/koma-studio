import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearThumbnailCache,
  createThumbnailFromUrl,
  getCachedThumbnailByKey,
  getCachedThumbnailUrl,
  getThumbnailCacheKey,
  getThumbnailCacheSize,
  hasCachedThumbnail,
  rememberThumbnailByKey,
  revokeLoadedImageUrls,
} from "./imagePerformance";

describe("imagePerformance WebP thumbnail cache", () => {
  let createdUrls: Set<string>;
  let revokedUrls: Set<string>;
  let urlCounter: number;
  let naturalWidth: number;
  let naturalHeight: number;
  let toBlobMimeType: string | undefined;
  let toBlobQuality: number | undefined;

  beforeEach(() => {
    clearThumbnailCache();
    createdUrls = new Set();
    revokedUrls = new Set();
    urlCounter = 0;
    naturalWidth = 2000;
    naturalHeight = 3000;
    toBlobMimeType = undefined;
    toBlobQuality = undefined;

    vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
      urlCounter += 1;
      const url = `blob:mock-thumb-${urlCounter}`;
      createdUrls.add(url);
      return url;
    });

    vi.spyOn(URL, "revokeObjectURL").mockImplementation((url: string) => {
      revokedUrls.add(url);
    });

    Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", {
      configurable: true,
      get: () => naturalWidth,
    });
    Object.defineProperty(HTMLImageElement.prototype, "naturalHeight", {
      configurable: true,
      get: () => naturalHeight,
    });
    Object.defineProperty(HTMLImageElement.prototype, "src", {
      configurable: true,
      get: function (this: HTMLImageElement) {
        return this.getAttribute("src") ?? "";
      },
      set: function (this: HTMLImageElement, val: string) {
        this.setAttribute("src", val);
        if (val) {
          queueMicrotask(() => {
            this.dispatchEvent(new Event("load"));
          });
        }
      },
    });

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      imageSmoothingEnabled: false,
      imageSmoothingQuality: "low",
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);

    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      function (
        this: HTMLCanvasElement,
        callback: (blob: Blob | null) => void,
        type?: string,
        quality?: unknown,
      ) {
        toBlobMimeType = type;
        toBlobQuality = typeof quality === "number" ? quality : undefined;
        const blob = new Blob(["mock-webp-bytes"], {
          type: type ?? "image/webp",
        });
        queueMicrotask(() => callback(blob));
      },
    );
  });

  afterEach(() => {
    clearThumbnailCache();
    vi.restoreAllMocks();
  });

  it("throws on invalid inputs", async () => {
    await expect(createThumbnailFromUrl("")).rejects.toThrow(
      "Invalid thumbnail input.",
    );
    await expect(createThumbnailFromUrl("blob:test", -1)).rejects.toThrow(
      "Invalid thumbnail input.",
    );
    await expect(
      createThumbnailFromUrl("blob:test", 400, 600, 1.5),
    ).rejects.toThrow("Invalid thumbnail input.");
    await expect(
      createThumbnailFromUrl("blob:test", 400, 600, 0.7, { timeoutMs: 0 }),
    ).rejects.toThrow("Invalid thumbnail input.");
  });

  it("creates reduced WebP thumbnail for large images and caches the result", async () => {
    naturalWidth = 3840;
    naturalHeight = 2160;

    const srcUrl = "blob:large-4k-image-1";
    const thumbUrl = await createThumbnailFromUrl(srcUrl, 400, 600, 0.7);

    expect(thumbUrl).toMatch(/^blob:mock-thumb-/);
    expect(thumbUrl).not.toBe(srcUrl);
    expect(toBlobMimeType).toBe("image/webp");
    expect(toBlobQuality).toBe(0.7);
    expect(hasCachedThumbnail(srcUrl)).toBe(true);
    expect(getCachedThumbnailUrl(srcUrl, 400, 600, 0.7)).toBe(thumbUrl);

    const callCountBefore = urlCounter;
    const secondThumbUrl = await createThumbnailFromUrl(srcUrl, 400, 600, 0.7);
    expect(secondThumbUrl).toBe(thumbUrl);
    expect(urlCounter).toBe(callCountBefore);
  });

  it("returns and caches original URL when image is already smaller than max dimensions", async () => {
    naturalWidth = 300;
    naturalHeight = 400;

    const srcUrl = "blob:small-image-1";
    const thumbUrl = await createThumbnailFromUrl(srcUrl, 400, 600, 0.7);

    expect(thumbUrl).toBe(srcUrl);
    expect(hasCachedThumbnail(srcUrl)).toBe(true);
    expect(getCachedThumbnailUrl(srcUrl, 400, 600, 0.7)).toBe(srcUrl);
  });

  it("deduplicates concurrent in-flight requests for the same source URL", async () => {
    naturalWidth = 2400;
    naturalHeight = 3600;

    const srcUrl = "blob:concurrent-image-1";
    const [thumb1, thumb2] = await Promise.all([
      createThumbnailFromUrl(srcUrl, 400, 600, 0.7),
      createThumbnailFromUrl(srcUrl, 400, 600, 0.7),
    ]);

    expect(thumb1).toBe(thumb2);
    expect(urlCounter).toBe(1);
  });

  it("clears cached thumbnails and revokes generated blob URLs", async () => {
    naturalWidth = 4000;
    naturalHeight = 6000;

    const srcUrl = "blob:image-to-clear";
    const thumbUrl = await createThumbnailFromUrl(srcUrl, 400, 600, 0.7);

    expect(getThumbnailCacheSize()).toBeGreaterThan(0);
    clearThumbnailCache();

    expect(getThumbnailCacheSize()).toBe(0);
    expect(hasCachedThumbnail(srcUrl)).toBe(false);
    expect(revokedUrls.has(thumbUrl)).toBe(true);
  });

  it("revokes cached thumbnails when revokeLoadedImageUrls is called", async () => {
    naturalWidth = 3000;
    naturalHeight = 4500;

    const img1Url = "blob:chapter-page-1";
    const thumb1Url = await createThumbnailFromUrl(img1Url, 400, 600, 0.7);

    expect(hasCachedThumbnail(img1Url)).toBe(true);

    revokeLoadedImageUrls([
      { url: img1Url, thumbnailUrl: thumb1Url },
    ]);

    expect(hasCachedThumbnail(img1Url)).toBe(false);
    expect(revokedUrls.has(img1Url)).toBe(true);
    expect(revokedUrls.has(thumb1Url)).toBe(true);
  });

  it("generates deterministic cache keys", () => {
    const key1 = getThumbnailCacheKey("blob:img-1", 400, 600, 0.7);
    const key2 = getThumbnailCacheKey("blob:img-1", 400, 600, 0.7);
    const key3 = getThumbnailCacheKey("blob:img-1", 800, 800, 0.6);

    expect(key1).toBe(key2);
    expect(key1).not.toBe(key3);
  });

  it("keeps a shared thumbnail URL alive while another cache key still holds it", () => {
    const shared = "blob:shared-thumb";
    rememberThumbnailByKey("key-a", shared);
    rememberThumbnailByKey("key-b", shared);

    for (let index = 0; index < 499; index += 1) {
      rememberThumbnailByKey(`filler-${index}`, `blob:filler-${index}`);
    }

    expect(getCachedThumbnailByKey("key-b")).toBe(shared);
    expect(revokedUrls.has(shared)).toBe(false);

    rememberThumbnailByKey("filler-499", "blob:filler-499");

    expect(getCachedThumbnailByKey("key-b")).toBeUndefined();
    expect(revokedUrls.has(shared)).toBe(true);
  });

  it("drops cache entries by value when revokeLoadedImageUrls runs", () => {
    rememberThumbnailByKey("opfs:hash-1:400:600:0.7", "blob:thumb-1");
    rememberThumbnailByKey("blob:page-1:400:600:0.7", "blob:thumb-1");

    revokeLoadedImageUrls([{ url: "blob:page-1", thumbnailUrl: "blob:thumb-1" }]);

    expect(getCachedThumbnailByKey("opfs:hash-1:400:600:0.7")).toBeUndefined();
    expect(getCachedThumbnailByKey("blob:page-1:400:600:0.7")).toBeUndefined();
    expect(revokedUrls.has("blob:thumb-1")).toBe(true);
  });

  it("preserves a shared thumbnailUrl in thumbnailCache when a duplicate page survives", () => {
    rememberThumbnailByKey("opfs:hash-dup:400:600:0.7", "blob:thumb-shared");

    revokeLoadedImageUrls(
      [{ url: "blob:page-dup-1", thumbnailUrl: "blob:thumb-shared" }],
      [{ url: "blob:page-dup-2", thumbnailUrl: "blob:thumb-shared" }],
    );

    expect(revokedUrls.has("blob:page-dup-1")).toBe(true);
    expect(revokedUrls.has("blob:thumb-shared")).toBe(false);
    expect(getCachedThumbnailByKey("opfs:hash-dup:400:600:0.7")).toBe(
      "blob:thumb-shared",
    );
  });
});
