import { useEffect } from 'react';
import type { CSSProperties } from 'react';

import { useI18n } from '../../../i18n';
import type { AioTextRegion } from '../../../types/dashboard.types';
import type { TypographyBounds } from '../../../typography/types';
import { buildDefaultRegionRenderText } from '../../../utils/dashboard.region.utils';

import './RegionPickerOverlay.css';

/** Fixed thumbnail box every row crops the page image into. */
export const REGION_THUMBNAIL_BOX: {
  readonly width: number;
  readonly height: number;
} = { width: 48, height: 64 };

/**
 * Pure CSS-crop math for a row thumbnail: the page image is scaled
 * proportionally (cover) to the fixed box and shifted so the region's bbox
 * lands inside the visible window.
 */
export const regionThumbnailStyle = (
  bbox: TypographyBounds,
  imageWidth: number,
  imageHeight: number,
): CSSProperties => {
  if (imageWidth <= 0 || imageHeight <= 0) {
    return {};
  }
  const scale = Math.max(
    REGION_THUMBNAIL_BOX.width / imageWidth,
    REGION_THUMBNAIL_BOX.height / imageHeight,
  );
  if (!Number.isFinite(scale) || scale <= 0) {
    return {};
  }
  return {
    backgroundSize: `${imageWidth * scale}px ${imageHeight * scale}px`,
    backgroundPosition: `-${bbox[0] * scale}px -${bbox[1] * scale}px`,
  };
};

interface RegionPickerOverlayProps {
  hits: readonly AioTextRegion[];
  imageWidth: number;
  imageHeight: number;
  thumbnailUrl?: string;
  onSelect: (regionId: string) => void;
  onClose: () => void;
}

/**
 * Overlap region picker (F3): listed when a pointerdown hits more than one
 * region and the topmost is not already selected. One row per hit, in draw
 * order; selecting a row commits that region and closes the picker.
 */
export default function RegionPickerOverlay({
  hits,
  imageWidth,
  imageHeight,
  thumbnailUrl,
  onSelect,
  onClose,
}: RegionPickerOverlayProps) {
  const { t } = useI18n();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="koma-region-picker__backdrop"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="koma-region-picker__panel"
        role="dialog"
        aria-label={t('renderPreview.regionPicker.aria')}
      >
        <h2 className="koma-region-picker__title">
          {t('renderPreview.regionPicker.title')}
        </h2>
        <ul className="koma-region-picker__list">
          {hits.map((region) => {
            const snippet = buildDefaultRegionRenderText(region);
            return (
              <li key={region.id}>
                <button
                  type="button"
                  className="koma-region-picker__row"
                  onClick={() => {
                    onSelect(region.id);
                    onClose();
                  }}
                >
                  {thumbnailUrl ? (
                    <span
                      aria-hidden="true"
                      className="koma-region-picker__thumb"
                      style={{
                        ...regionThumbnailStyle(region.bbox, imageWidth, imageHeight),
                        backgroundImage: `url(${thumbnailUrl})`,
                      }}
                    />
                  ) : null}
                  <span className="koma-region-picker__snippet">
                    {snippet.length > 0 ? snippet : region.id}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
