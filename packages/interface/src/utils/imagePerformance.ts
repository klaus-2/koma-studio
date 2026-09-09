/**
 * Image utilities for performance optimization.
 * - Generates downscaled thumbnails to reduce memory usage
 * - Provides lazy image loading via IntersectionObserver
 * - Manages Object URL lifecycle to prevent memory leaks
 */

const THUMBNAIL_MAX_DIMENSION = 800;
const THUMBNAIL_QUALITY = 0.6;

let _sharedCanvas: HTMLCanvasElement | null = null;
let _sharedCtx: CanvasRenderingContext2D | null = null;

/**
 * Reuses the same canvas to minimize memory allocations.
 */
function getSharedCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  if (!_sharedCanvas) {
    _sharedCanvas = document.createElement('canvas');
    _sharedCtx = _sharedCanvas.getContext('2d', { alpha: false })!;
  }
  return { canvas: _sharedCanvas, ctx: _sharedCtx! };
}

/**
 * Creates a downscaled thumbnail from an object URL.
 * The original URL is NOT revoked - caller manages that lifecycle.
 *
 * @param srcUrl - The blob URL of the source image
 * @param maxWidth - Max width of thumbnail (default 800)
 * @param maxHeight - Max height of thumbnail (default 800)
 * @param quality - JPEG quality 0-1 (default 0.6)
 * @returns Promise resolving to a blob URL of the thumbnail, or the original URL if small enough
 */
export function createThumbnailFromUrl(
  srcUrl: string,
  maxWidth = THUMBNAIL_MAX_DIMENSION,
  maxHeight = THUMBNAIL_MAX_DIMENSION,
  quality = THUMBNAIL_QUALITY,
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // If image is small enough, no need to downscale
      if (img.width <= maxWidth && img.height <= maxHeight) {
        resolve(srcUrl);
        return;
      }

      const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const { canvas, ctx } = getSharedCanvas();
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(URL.createObjectURL(blob));
          } else {
            resolve(srcUrl);
          }
        },
        'image/jpeg',
        quality,
      );
    };
    img.onerror = () => {
      // On error, return original URL
      resolve(srcUrl);
    };
    img.src = srcUrl;
  });
}

/**
 * Revoke all blob: Object URLs from a LoadedImage array.
 */
export function revokeLoadedImageUrls(images: Array<{ url: string; thumbnailUrl?: string }>): void {
  for (const img of images) {
    if (img.url.startsWith('blob:')) URL.revokeObjectURL(img.url);
    if (img.thumbnailUrl?.startsWith('blob:')) URL.revokeObjectURL(img.thumbnailUrl);
  }
}
