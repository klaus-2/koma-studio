import type { MouseEvent, Ref, RefObject, TouchEvent } from 'react';
import {
  Eye,
  Image as ImageIcon,
  Minus,
  Plus,
  RefreshCw,
  RotateCw,
  Scissors,
} from 'lucide-react';

import { useI18n } from '../../../i18n';
import type {
  OptimizerImageInput,
  OptimizerPreviewStats,
} from './ChapterOptimizerWorkspace.types';
import {
  MAX_ZOOM_LEVEL,
  MIN_ZOOM_LEVEL,
  savingsColor,
  savingsPercent,
} from './ChapterOptimizerWorkspace.utils';

type ChapterOptimizerPreviewPanelProps = {
  activeImage: OptimizerImageInput | null;
  activeIdx: number;
  images: OptimizerImageInput[];
  previewUrl: string | null;
  originalPreviewUrl: string | null;
  previewStats: OptimizerPreviewStats | null;
  previewLoading: boolean;
  showCompare: boolean;
  comparePosition: number;
  compareRef: RefObject<HTMLDivElement | null>;
  thumbStripRef: Ref<HTMLDivElement>;
  zoomLevel: number;
  formatBytes: (value: number) => string;
  onActiveImageChange: (imageId: string) => void;
  onCompareMove: (
    e: MouseEvent<HTMLDivElement> | TouchEvent<HTMLDivElement>,
  ) => void;
  onCompareToggle: () => void;
  onCycleRotation: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
};

export default function ChapterOptimizerPreviewPanel({
  activeImage,
  activeIdx,
  images,
  previewUrl,
  originalPreviewUrl,
  previewStats,
  previewLoading,
  showCompare,
  comparePosition,
  compareRef,
  thumbStripRef,
  zoomLevel,
  formatBytes,
  onActiveImageChange,
  onCompareMove,
  onCompareToggle,
  onCycleRotation,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}: ChapterOptimizerPreviewPanelProps) {
  const { t } = useI18n();

  return (
    <div className="koma-optim__panel koma-optim__panel--preview">
      <div className="koma-optim__preview-header">
        <div className="koma-optim__section-head">
          <span className="koma-optim__section-icon" aria-hidden="true">
            <Eye size={11} />
          </span>
          {t('optimizer.panel.preview')}
          {activeIdx >= 0 && (
            <span className="koma-optim__preview-counter">
              {activeIdx + 1}/{images.length}
            </span>
          )}
        </div>
        <div className="koma-optim__preview-toolbar">
          {previewUrl && originalPreviewUrl && (
            <button
              type="button"
              className={`koma-optim__compare-toggle${showCompare ? ' koma-optim__compare-toggle--active' : ''}`}
              onClick={onCompareToggle}
              title={t('optimizer.preview.compare')}
            >
              <Scissors size={11} />
              {t('optimizer.preview.compare')}
            </button>
          )}
          <button
            type="button"
            className="koma-optim__toolbar-btn"
            onClick={onCycleRotation}
            title={t('optimizer.config.rotation')}
          >
            <RotateCw size={12} />
          </button>
          <div className="koma-optim__zoom-controls">
            <button
              type="button"
              className="koma-optim__toolbar-btn"
              onClick={onZoomOut}
              disabled={zoomLevel <= MIN_ZOOM_LEVEL}
            >
              <Minus size={11} />
            </button>
            <button
              type="button"
              className="koma-optim__zoom-label"
              onClick={onZoomReset}
              title="Reset zoom"
            >
              {Math.round(zoomLevel * 100)}%
            </button>
            <button
              type="button"
              className="koma-optim__toolbar-btn"
              onClick={onZoomIn}
              disabled={zoomLevel >= MAX_ZOOM_LEVEL}
            >
              <Plus size={11} />
            </button>
          </div>
        </div>
      </div>

      {activeImage ? (
        <>
          {images.length > 1 && (
            <div className="koma-optim__thumb-strip" ref={thumbStripRef}>
              {images.map((img, idx) => (
                <button
                  key={img.id}
                  type="button"
                  data-thumb-id={img.id}
                  className={`koma-optim__thumb${img.id === activeImage.id ? ' koma-optim__thumb--active' : ''}`}
                  onClick={() => onActiveImageChange(img.id)}
                  title={img.file.name}
                >
                  <img
                    src={img.url}
                    alt={img.file.name}
                    className="koma-optim__thumb-img"
                    loading="lazy"
                  />
                  <span className="koma-optim__thumb-idx">{idx + 1}</span>
                </button>
              ))}
            </div>
          )}

          <div className="koma-optim__preview-wrap">
            {previewLoading && (
              <div className="koma-optim__preview-loading">
                <RefreshCw size={16} className="koma-optim__spin" />
                <span>{t('optimizer.preview.generating')}</span>
              </div>
            )}
            {showCompare && previewUrl && originalPreviewUrl ? (
              <div
                ref={compareRef}
                className="koma-optim__compare"
                onMouseMove={onCompareMove}
                onTouchMove={onCompareMove}
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'center center',
                }}
              >
                <img
                  src={originalPreviewUrl}
                  alt={t('optimizer.preview.before')}
                  className="koma-optim__compare-img koma-optim__compare-img--original"
                />
                <div
                  className="koma-optim__compare-clip"
                  style={{ clipPath: `inset(0 ${100 - comparePosition}% 0 0)` }}
                >
                  <img
                    src={previewUrl}
                    alt={t('optimizer.preview.after')}
                    className="koma-optim__compare-img"
                  />
                </div>
                <div
                  className="koma-optim__compare-divider"
                  style={{ left: `${comparePosition}%` }}
                >
                  <div className="koma-optim__compare-handle" />
                </div>
                <span className="koma-optim__compare-label koma-optim__compare-label--left">
                  {t('optimizer.preview.original')}
                </span>
                <span className="koma-optim__compare-label koma-optim__compare-label--right">
                  {t('optimizer.preview.optimized')}
                </span>
              </div>
            ) : previewUrl ? (
              <img
                src={previewUrl}
                alt={activeImage.file.name}
                className="koma-optim__preview-img"
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'center center',
                }}
              />
            ) : !previewLoading ? (
              <div className="koma-optim__empty">{t('optimizer.preview.generating')}</div>
            ) : null}
          </div>

          {previewStats && (
            <div className="koma-optim__stats-bar">
              <div className="koma-optim__stat">
                <span className="koma-optim__stat-label">{t('optimizer.preview.before')}</span>
                <span className="koma-optim__stat-value">{formatBytes(previewStats.originalBytes)}</span>
              </div>
              <div className="koma-optim__stat">
                <span className="koma-optim__stat-label">{t('optimizer.preview.after')}</span>
                <span className="koma-optim__stat-value">{formatBytes(previewStats.optimizedBytes)}</span>
              </div>
              <div className="koma-optim__stat">
                <span className="koma-optim__stat-label">{t('optimizer.preview.reduction')}</span>
                <span
                  className="koma-optim__stat-value koma-optim__stat-value--savings"
                  style={{ color: savingsColor(savingsPercent(previewStats.originalBytes, previewStats.optimizedBytes)) }}
                >
                  -{savingsPercent(previewStats.originalBytes, previewStats.optimizedBytes)}%
                </span>
              </div>
              <div className="koma-optim__stat">
                <span className="koma-optim__stat-label">{t('optimizer.preview.dimensions')}</span>
                <span className="koma-optim__stat-value">
                  {previewStats.width}&times;{previewStats.height}
                </span>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="koma-optim__empty-state">
          <ImageIcon size={28} strokeWidth={1.2} />
          <span>{t('optimizer.preview.empty')}</span>
        </div>
      )}
    </div>
  );
}
