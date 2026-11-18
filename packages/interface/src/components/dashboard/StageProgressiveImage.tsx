import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

interface StageProgressiveImageProps {
  placeholderSrc: string | null;
  src: string;
  alt: string;
  className?: string;
  imgStyle?: CSSProperties;
  loading?: 'lazy' | 'eager';
}

/**
 * Low-res placeholder layered underneath the full image; the full layer fades
 * in on load so the card never flashes blank. Both layers must receive the
 * same absolute box via `imgStyle` or the placeholder will not overlap the
 * full image 1:1. The placeholder layer is dropped entirely when there is
 * nothing to stage ahead of the full image (`!placeholderSrc`, `!src`, or
 * `placeholderSrc === src`), rendering a single un-faded `<img>`.
 */
export function StageProgressiveImage({
  placeholderSrc,
  src,
  alt,
  className,
  imgStyle,
  loading,
}: StageProgressiveImageProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [loadedForSrc, setLoadedForSrc] = useState<string | null>(null);
  const [failedForSrc, setFailedForSrc] = useState<string | null>(null);
  const isFailed = src !== '' && failedForSrc === src;
  const showPlaceholder =
    !isFailed &&
    placeholderSrc !== null &&
    placeholderSrc !== '' &&
    src !== '' &&
    placeholderSrc !== src;
  const isLoaded = !showPlaceholder || loadedForSrc === src;

  // A cached image can finish decoding before React attaches onLoad; recover
  // it on the commit following the `src` swap instead of waiting for an event
  // that will never fire. `loadedForSrc === src` also resets stale loaded
  // state on the render pass itself, so a src change never flashes the old
  // full image.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      setLoadedForSrc(src);
      setFailedForSrc((prev) => (prev === src ? null : prev));
    }
  }, [src]);

  return (
    <>
      {showPlaceholder && (
        <img
          src={placeholderSrc}
          alt=""
          aria-hidden="true"
          draggable={false}
          decoding="async"
          loading={loading}
          className={className}
          style={{
            ...imgStyle,
            pointerEvents: 'none',
            opacity: isLoaded ? 0 : 1,
            // `.koma-preview-card__img` paints a box-shadow; once both layers
            // are opaque the placeholder's copy doubles, so it is suppressed
            // on load.
            boxShadow: isLoaded ? 'none' : undefined,
          }}
        />
      )}
      <img
        key={src}
        ref={imgRef}
        src={src}
        alt={alt}
        decoding="async"
        loading={loading}
        data-load-error={isFailed ? 'true' : undefined}
        onLoad={(event) => {
          if (event.currentTarget.getAttribute('src') === src) {
            setLoadedForSrc(src);
            setFailedForSrc((prev) => (prev === src ? null : prev));
          }
        }}
        onError={(event) => {
          if (event.currentTarget.getAttribute('src') === src && src !== '') {
            console.warn('[stage-image] full-resolution image failed to load', {
              src,
            });
            setFailedForSrc(src);
          }
        }}
        className={className}
        style={{
          ...imgStyle,
          opacity: isLoaded ? 1 : 0,
          transition: showPlaceholder ? 'opacity 120ms ease-out' : undefined,
        }}
      />
    </>
  );
}
