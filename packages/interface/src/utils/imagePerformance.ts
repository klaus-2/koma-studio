const THUMBNAIL_MAX_DIMENSION = 800;
const THUMBNAIL_QUALITY = 0.6;
const THUMBNAIL_CONCURRENCY = 2;

export type ThumbnailFailureCode =
  | "IMAGE_LOAD_FAILED"
  | "CANVAS_UNAVAILABLE"
  | "IMAGE_ENCODING_FAILED";

export interface ThumbnailOptions {
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  readonly onFailure?: (code: ThumbnailFailureCode) => void;
}

interface PermitWaiter {
  readonly signal: AbortSignal;
  readonly resolve: (release: () => void) => void;
  readonly reject: (reason: unknown) => void;
  readonly onAbort: () => void;
}

class ThumbnailError extends Error {
  constructor(readonly code: ThumbnailFailureCode) {
    super(code);
    this.name = "ThumbnailError";
  }
}

let activeJobs = 0;
const waiters: PermitWaiter[] = [];

const dispatchWaiters = (): void => {
  while (activeJobs < THUMBNAIL_CONCURRENCY && waiters.length > 0) {
    const waiter = waiters.shift();
    if (!waiter) break;

    waiter.signal.removeEventListener("abort", waiter.onAbort);

    if (waiter.signal.aborted) {
      waiter.reject(waiter.signal.reason);
      continue;
    }

    activeJobs += 1;
    let released = false;

    waiter.resolve(() => {
      if (released) return;
      released = true;
      activeJobs -= 1;
      dispatchWaiters();
    });
  }
};

const acquirePermit = (signal: AbortSignal): Promise<() => void> =>
  new Promise((resolve, reject) => {
    signal.throwIfAborted();

    const onAbort = (): void => {
      const index = waiters.findIndex((waiter) => waiter.onAbort === onAbort);
      if (index >= 0) waiters.splice(index, 1);
      reject(signal.reason);
    };

    waiters.push({ signal, resolve, reject, onAbort });
    signal.addEventListener("abort", onAbort, { once: true });
    dispatchWaiters();
  });

const loadImage = (
  srcUrl: string,
  signal: AbortSignal,
): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    signal.throwIfAborted();

    const image = new Image();
    image.decoding = "async";

    if (/^https?:/iu.test(srcUrl)) image.crossOrigin = "anonymous";

    const cleanup = (): void => {
      image.onload = null;
      image.onerror = null;
      signal.removeEventListener("abort", onAbort);
    };

    const onAbort = (): void => {
      cleanup();
      image.src = "";
      reject(signal.reason);
    };

    image.onload = () => {
      cleanup();

      if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
        reject(new ThumbnailError("IMAGE_LOAD_FAILED"));
      } else {
        resolve(image);
      }
    };

    image.onerror = () => {
      cleanup();
      reject(new ThumbnailError("IMAGE_LOAD_FAILED"));
    };

    signal.addEventListener("abort", onAbort, { once: true });
    image.src = srcUrl;
  });

const encodeCanvas = (
  canvas: HTMLCanvasElement,
  quality: number,
  signal: AbortSignal,
): Promise<Blob> =>
  new Promise((resolve, reject) => {
    signal.throwIfAborted();

    const onAbort = (): void => {
      reject(signal.reason);
    };

    signal.addEventListener("abort", onAbort, { once: true });

    try {
      canvas.toBlob(
        (blob) => {
          signal.removeEventListener("abort", onAbort);

          if (signal.aborted) {
            reject(signal.reason);
          } else if (blob) {
            resolve(blob);
          } else {
            reject(new ThumbnailError("IMAGE_ENCODING_FAILED"));
          }
        },
        "image/webp",
        quality,
      );
    } catch {
      signal.removeEventListener("abort", onAbort);
      reject(new ThumbnailError("IMAGE_ENCODING_FAILED"));
    }
  });

const MAX_THUMBNAIL_CACHE_SIZE = 500;
const thumbnailCache = new Map<string, string>();
const inFlightJobs = new Map<string, Promise<string>>();

export const getThumbnailCacheKey = (
  srcUrl: string,
  maxWidth = THUMBNAIL_MAX_DIMENSION,
  maxHeight = THUMBNAIL_MAX_DIMENSION,
  quality = THUMBNAIL_QUALITY,
): string => `${srcUrl}:${maxWidth}:${maxHeight}:${quality}`;

const rememberThumbnail = (cacheKey: string, thumbUrl: string): void => {
  thumbnailCache.delete(cacheKey);
  thumbnailCache.set(cacheKey, thumbUrl);
  if (thumbnailCache.size > MAX_THUMBNAIL_CACHE_SIZE) {
    const oldestKey = thumbnailCache.keys().next().value;
    if (oldestKey !== undefined) {
      const oldestUrl = thumbnailCache.get(oldestKey);
      if (
        oldestUrl &&
        oldestUrl.startsWith("blob:") &&
        !oldestKey.startsWith(`${oldestUrl}:`)
      ) {
        URL.revokeObjectURL(oldestUrl);
      }
      thumbnailCache.delete(oldestKey);
    }
  }
};

export const getCachedThumbnailUrl = (
  srcUrl: string,
  maxWidth = THUMBNAIL_MAX_DIMENSION,
  maxHeight = THUMBNAIL_MAX_DIMENSION,
  quality = THUMBNAIL_QUALITY,
): string | undefined => {
  const specific = thumbnailCache.get(
    getThumbnailCacheKey(srcUrl, maxWidth, maxHeight, quality),
  );
  if (specific) return specific;
  for (const [key, val] of thumbnailCache.entries()) {
    if (key.startsWith(`${srcUrl}:`)) return val;
  }
  return undefined;
};

export const hasCachedThumbnail = (srcUrl: string): boolean => {
  for (const key of thumbnailCache.keys()) {
    if (key.startsWith(`${srcUrl}:`)) return true;
  }
  return false;
};

export const clearThumbnailCache = (): void => {
  for (const [key, thumbUrl] of thumbnailCache.entries()) {
    if (thumbUrl.startsWith("blob:") && !key.startsWith(`${thumbUrl}:`)) {
      URL.revokeObjectURL(thumbUrl);
    }
  }
  thumbnailCache.clear();
};

export const getThumbnailCacheSize = (): number => thumbnailCache.size;

export const createThumbnailFromUrl = async (
  srcUrl: string,
  maxWidth = THUMBNAIL_MAX_DIMENSION,
  maxHeight = THUMBNAIL_MAX_DIMENSION,
  quality = THUMBNAIL_QUALITY,
  options: ThumbnailOptions = {},
): Promise<string> => {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const isDimensionValid = (value: number): boolean =>
    Number.isFinite(value) && Number.isInteger(value) && value > 0 && value <= 16_384;
  if (
    typeof srcUrl !== "string" ||
    srcUrl.length === 0 ||
    !isDimensionValid(maxWidth) ||
    !isDimensionValid(maxHeight) ||
    !Number.isFinite(quality) ||
    quality < 0 ||
    quality > 1 ||
    !Number.isFinite(timeoutMs) ||
    !Number.isInteger(timeoutMs) ||
    timeoutMs <= 0 ||
    timeoutMs > 120_000
  ) {
    throw new Error("Invalid thumbnail input.");
  }

  const cacheKey = getThumbnailCacheKey(srcUrl, maxWidth, maxHeight, quality);
  const cached = thumbnailCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const existingInFlight = inFlightJobs.get(cacheKey);
  if (existingInFlight) {
    if (options.signal) {
      return new Promise<string>((resolve, reject) => {
        const onAbort = (): void => reject(options.signal?.reason);
        options.signal?.addEventListener("abort", onAbort, { once: true });
        existingInFlight.then(
          (val) => {
            options.signal?.removeEventListener("abort", onAbort);
            resolve(val);
          },
          (err: unknown) => {
            options.signal?.removeEventListener("abort", onAbort);
            reject(err);
          },
        );
      });
    }
    return existingInFlight;
  }

  const executeJob = async (): Promise<string> => {
    options.signal?.throwIfAborted();

    const controller = new AbortController();
    const onAbort = (): void => {
      controller.abort(options.signal?.reason);
    };
    const timeout = globalThis.setTimeout(() => {
      controller.abort(
        new DOMException("Thumbnail generation timed out.", "TimeoutError"),
      );
    }, timeoutMs);

    options.signal?.addEventListener("abort", onAbort, { once: true });
    if (options.signal?.aborted) onAbort();

    let release: (() => void) | undefined;
    let image: HTMLImageElement | undefined;
    let canvas: HTMLCanvasElement | undefined;

    try {
      release = await acquirePermit(controller.signal);
      image = await loadImage(srcUrl, controller.signal);
      controller.signal.throwIfAborted();

      if (
        image.naturalWidth <= maxWidth &&
        image.naturalHeight <= maxHeight
      ) {
        rememberThumbnail(cacheKey, srcUrl);
        return srcUrl;
      }

      const scale = Math.min(
        maxWidth / image.naturalWidth,
        maxHeight / image.naturalHeight,
      );

      canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.floor(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.floor(image.naturalHeight * scale));

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new ThumbnailError("CANVAS_UNAVAILABLE");

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

      const blob = await encodeCanvas(canvas, quality, controller.signal);
      controller.signal.throwIfAborted();

      const thumbUrl = URL.createObjectURL(blob);
      rememberThumbnail(cacheKey, thumbUrl);
      return thumbUrl;
    } catch (error: unknown) {
      if (controller.signal.aborted) throw controller.signal.reason;

      const code =
        error instanceof ThumbnailError
          ? error.code
          : "IMAGE_ENCODING_FAILED";

      options.onFailure?.(code);
      return srcUrl;
    } finally {
      globalThis.clearTimeout(timeout);
      options.signal?.removeEventListener("abort", onAbort);

      if (image) image.src = "";
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }

      release?.();
    }
  };

  const job = executeJob();
  inFlightJobs.set(cacheKey, job);
  try {
    return await job;
  } finally {
    inFlightJobs.delete(cacheKey);
  }
};

export const revokeLoadedImageUrls = (
  images: readonly {
    readonly url: string;
    readonly thumbnailUrl?: string;
  }[],
): void => {
  const urls = new Set<string>();

  for (const image of images) {
    if (image.url.startsWith("blob:")) urls.add(image.url);
    if (image.thumbnailUrl?.startsWith("blob:")) {
      urls.add(image.thumbnailUrl);
    }

    for (const [key, thumbUrl] of thumbnailCache.entries()) {
      if (key.startsWith(`${image.url}:`)) {
        if (thumbUrl.startsWith("blob:") && thumbUrl !== image.url) {
          urls.add(thumbUrl);
        }
        thumbnailCache.delete(key);
      }
    }
  }

  for (const url of urls) URL.revokeObjectURL(url);
};
