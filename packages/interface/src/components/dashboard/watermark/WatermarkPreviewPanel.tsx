import type { Dispatch, RefObject, SetStateAction } from 'react';
import {
  Eye,
  Image as ImageIcon,
  Minus,
  Plus,
  RotateCcw,
  ShieldCheck,
  Stamp,
} from 'lucide-react';

import { useI18n } from '../../../i18n';
import type {
  WatermarkAnchor,
  WatermarkLoadedImage,
  WatermarkResultEntry,
  WatermarkTextAvoidanceZone,
} from './watermarkTypes';
import WatermarkTextZoneOverlay from './WatermarkTextZoneOverlay';
import { ZOOM_DEFAULT, ZOOM_STEPS } from './watermark-ui-constants';

type WatermarkPreviewPanelProps = {
  images: WatermarkLoadedImage[];
  activeImage: WatermarkLoadedImage | null;
  activeTextZones: WatermarkTextAvoidanceZone[];
  textZoneCache: Record<string, WatermarkTextAvoidanceZone[]>;
  resultsById: Map<string, WatermarkResultEntry>;
  hasRenderableLayer: boolean;
  previewUrl: string | null;
  previewBusy: boolean;
  previewAnchor: WatermarkAnchor;
  compareMode: 'split' | 'preview';
  compareValue: number;
  zoom: number;
  showTextZoneOverlay: boolean;
  setActiveImageId: Dispatch<SetStateAction<string | null>>;
  setCompareMode: Dispatch<SetStateAction<'split' | 'preview'>>;
  setCompareValue: Dispatch<SetStateAction<number>>;
  setZoom: Dispatch<SetStateAction<number>>;
  thumbsStripRef: RefObject<HTMLDivElement | null>;
  previewStageRef: RefObject<HTMLDivElement | null>;
};

export default function WatermarkPreviewPanel({
  images,
  activeImage,
  activeTextZones,
  textZoneCache,
  resultsById,
  hasRenderableLayer,
  previewUrl,
  previewBusy,
  previewAnchor,
  compareMode,
  compareValue,
  zoom,
  showTextZoneOverlay,
  setActiveImageId,
  setCompareMode,
  setCompareValue,
  setZoom,
  thumbsStripRef,
  previewStageRef,
}: WatermarkPreviewPanelProps) {
  const { t } = useI18n();

  return (
    <div className="koma-wm-preview">
      <div className="koma-wm-preview__head">
        <div className="koma-wm-preview__title">
          <span className="koma-wm-preview__title-icon" aria-hidden="true">
            <Eye size={12} />
          </span>
          {t('watermark.panel.preview')}
        </div>
        <div className="koma-wm-preview__controls">
          {activeImage && hasRenderableLayer && (
            <div className="koma-wm-compare-toggle">
              <button
                type="button"
                className={`koma-wm-compare-btn${compareMode === 'split' ? ' koma-wm-compare-btn--active' : ''}`}
                onClick={() => setCompareMode('split')}
              >
                {t('watermark.preview.compare')}
              </button>
              <button
                type="button"
                className={`koma-wm-compare-btn${compareMode === 'preview' ? ' koma-wm-compare-btn--active' : ''}`}
                onClick={() => setCompareMode('preview')}
              >
                {t('watermark.preview.mode')}
              </button>
            </div>
          )}
          <div className="koma-wm-zoom-controls">
            <button
              type="button"
              className="koma-wm-zoom-btn"
              onClick={() =>
                setZoom((current) => {
                  const index = ZOOM_STEPS.findIndex((step) => step >= current);
                  return ZOOM_STEPS[Math.max((index === -1 ? 0 : index) - 1, 0)] ?? current;
                })
              }
              aria-label="Zoom out"
            >
              <Minus size={12} />
            </button>
            <span className="koma-wm-zoom-label">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              className="koma-wm-zoom-btn"
              onClick={() =>
                setZoom((current) => {
                  const index = ZOOM_STEPS.findIndex((step) => step >= current);
                  return ZOOM_STEPS[
                    Math.min(
                      (index === -1 ? ZOOM_STEPS.length - 1 : index) + 1,
                      ZOOM_STEPS.length - 1,
                    )
                  ] ?? current;
                })
              }
              aria-label="Zoom in"
            >
              <Plus size={12} />
            </button>
            {zoom !== ZOOM_DEFAULT && (
              <button
                type="button"
                className="koma-wm-zoom-btn"
                onClick={() => setZoom(ZOOM_DEFAULT)}
                aria-label="Reset zoom"
              >
                <RotateCcw size={10} />
              </button>
            )}
          </div>
        </div>
      </div>

      {images.length === 0 ? (
        <div className="koma-wm-stage">
          <div className="koma-wm-empty">
            <div className="koma-wm-empty__icon">
              <ImageIcon size={24} />
            </div>
            <p className="koma-wm-empty__title">{t('watermark.preview.empty.title')}</p>
            <p className="koma-wm-empty__desc">
              {t('watermark.preview.empty.desc')}
            </p>
          </div>
        </div>
      ) : !hasRenderableLayer ? (
        <div className="koma-wm-stage">
          <div className="koma-wm-empty">
            <div className="koma-wm-empty__icon">
              <Stamp size={24} />
            </div>
            <p className="koma-wm-empty__title">{t('watermark.preview.noLayer.title')}</p>
            <p className="koma-wm-empty__desc">
              {t('watermark.preview.noLayer.desc')}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="koma-wm-thumbs" ref={thumbsStripRef}>
            {images.map((image, index) => (
              <button
                key={image.id}
                type="button"
                data-thumb-id={image.id}
                className={`koma-wm-thumb${activeImage?.id === image.id ? ' koma-wm-thumb--active' : ''}${textZoneCache[image.id] ? ' koma-wm-thumb--detected' : ''}`}
                onClick={() => setActiveImageId(image.id)}
              >
                <img
                  src={resultsById.get(image.id)?.previewUrl ?? image.url}
                  alt={image.file.name}
                />
                <span className="koma-wm-thumb__num">{index + 1}</span>
                {textZoneCache[image.id] && (
                  <span className="koma-wm-thumb__detect-dot" aria-hidden="true" />
                )}
              </button>
            ))}
          </div>

          <div
            className="koma-wm-stage"
            ref={previewStageRef}
            style={{ overflow: 'auto' }}
          >
            <div className="koma-wm-stage__zoom-wrap" style={{ zoom }}>
              {activeImage && (
                <>
                  {compareMode === 'split' && previewUrl ? (
                    <div className="koma-wm-stage__compare-container">
                      <img
                        src={activeImage.url}
                        alt={t('watermark.preview.original')}
                        className="koma-wm-stage__img"
                      />
                      <div
                        className="koma-wm-stage__overlay"
                        style={{
                          clipPath: `inset(0 ${100 - compareValue}% 0 0)`,
                        }}
                      >
                        <img
                          src={previewUrl}
                          alt={t('watermark.preview.watermark')}
                          className="koma-wm-stage__img"
                        />
                      </div>
                      {showTextZoneOverlay && activeTextZones.length > 0 && (
                        <WatermarkTextZoneOverlay
                          image={activeImage}
                          zones={activeTextZones}
                        />
                      )}
                      <div
                        className="koma-wm-stage__divider"
                        style={{ left: `${compareValue}%` }}
                        aria-hidden="true"
                      />
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={compareValue}
                        onChange={(e) => setCompareValue(Number(e.target.value))}
                        className="koma-wm-stage__range"
                        aria-label={t('watermark.preview.compareAria')}
                      />
                    </div>
                  ) : (
                    <div className="koma-wm-stage__compare-container">
                      <img
                        src={previewUrl ?? activeImage.url}
                        alt={t('watermark.panel.preview')}
                        className="koma-wm-stage__img"
                      />
                      {showTextZoneOverlay && activeTextZones.length > 0 && (
                        <WatermarkTextZoneOverlay
                          image={activeImage}
                          zones={activeTextZones}
                        />
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            {previewBusy && (
              <div className="koma-wm-stage__busy">
                <span className="auth-spinner" style={{ width: 16, height: 16 }} />
              </div>
            )}
          </div>

          {activeImage && (
            <div className="koma-wm-file-bar">
              <span className="koma-wm-file-bar__name">
                {activeImage.file.name}
              </span>
              <div className="koma-wm-file-bar__meta">
                <span className="koma-wm-file-bar__dims">
                  {activeImage.width} x {activeImage.height}
                </span>
                <span className="koma-wm-file-bar__anchor">
                  {previewBusy ? t('watermark.preview.generating') : previewAnchor}
                </span>
                {activeTextZones.length > 0 && (
                  <span className="koma-wm-file-bar__zones">
                    <ShieldCheck size={9} /> {activeTextZones.length}
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
