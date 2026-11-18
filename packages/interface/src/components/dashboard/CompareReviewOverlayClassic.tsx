import { useRef } from 'react';
import { Columns2, X } from 'lucide-react';

import { useI18n } from '../../i18n';
import type { TranslationKey } from '../../i18n/messages';
import type { CompareReviewView } from '../../types/dashboard.types';
import { KomaDialog } from '@koma/ui/components/dialog';
import { useCompareReviewModel } from './compare-review/useCompareReviewModel';
import type { CompareMaskPolygon } from './compare-review/useCompareReviewModel';
import type { CompareReviewModel } from './compare-review/useCompareReviewModel';

export interface CompareReviewOverlayProps {
  onClose: () => void;
}

const VIEW_LABEL_KEYS: Record<CompareReviewView, TranslationKey> = {
  original: 'dashboard.compareReview.viewOriginal',
  mask: 'dashboard.compareReview.viewMask',
  rendered: 'dashboard.compareReview.viewRendered',
};

const VIEW_TOGGLE_ORDER: readonly CompareReviewView[] = [
  'original',
  'mask',
  'rendered',
];

const polygonPoints = (polygon: CompareMaskPolygon): string =>
  polygon.points.map((point) => `${point[0]},${point[1]}`).join(' ');

/**
 * One side-by-side viewer. The `rendered` view shows the render-stage canvas
 * over the cleaned base page; `original` shows the raw page; `mask` overlays
 * the vector cleaning-mask polygons on the raw page. All views share the same
 * transform string, so zoom/pan stay exactly synchronized across panes.
 */
function ComparePaneClassic({
  model,
  view,
}: {
  model: CompareReviewModel;
  view: CompareReviewView;
}) {
  const { t } = useI18n();
  const image = model.image;
  if (!image) return null;

  const captionKey =
    view === 'mask' && model.maskPolygons.length === 0
      ? 'dashboard.compareReview.noMask'
      : VIEW_LABEL_KEYS[view];

  return (
    <figure
      className="koma-compare-pane"
      onPointerDown={model.beginPan}
      onPointerMove={model.movePan}
      onPointerUp={model.endPan}
      onPointerCancel={model.endPan}
    >
      <figcaption className="koma-compare-pane__caption">
        {t(captionKey)}
      </figcaption>
      <div className="koma-compare-pane__viewport">
        <div
          className="koma-compare-pane__content"
          style={{
            width: image.width,
            height: image.height,
            transform: model.paneTransform,
            transformOrigin: '0 0',
          }}
        >
          <img
            src={
              view === 'rendered'
                ? model.previewSrc ?? undefined
                : model.originalSrc ?? undefined
            }
            alt={image.file.name}
            className="koma-compare-pane__img"
            width={image.width}
            height={image.height}
            draggable={false}
            decoding="async"
          />
          {view === 'rendered' && (
            <canvas
              ref={model.renderCanvasRef}
              className="koma-compare-pane__canvas"
              width={image.width}
              height={image.height}
            />
          )}
          {view === 'mask' && (
            <svg
              className="koma-compare-pane__mask"
              viewBox={`0 0 ${image.width} ${image.height}`}
              aria-hidden="true"
            >
              {model.maskPolygons.map((polygon) => (
                <polygon
                  key={`mask-polygon-${polygon.regionId}`}
                  className="koma-compare-pane__maskPolygon"
                  points={polygonPoints(polygon)}
                />
              ))}
            </svg>
          )}
        </div>
      </div>
    </figure>
  );
}

export function CompareReviewOverlayClassic({
  onClose,
}: CompareReviewOverlayProps) {
  const { t } = useI18n();
  const panesRef = useRef<HTMLDivElement | null>(null);
  const model = useCompareReviewModel({ panesRef });

  return (
    <KomaDialog
      open
      onClose={onClose}
      layerClassName="koma-compare-backdrop"
      modalClassName="koma-compare-modal"
      label={t('dashboard.compareReview.title')}
    >
      <div className="koma-compare-modal__header">
        <div className="koma-compare-modal__title">
          <Columns2 size={14} aria-hidden="true" />
          <span>{t('dashboard.compareReview.title')}</span>
        </div>
        <div
          className="koma-compare-modal__views"
          role="group"
          aria-label={t('dashboard.compareReview.title')}
        >
          {VIEW_TOGGLE_ORDER.map((view) => (
            <button
              key={view}
              type="button"
              className={`koma-compare-modal__viewBtn${
                model.leftView === view
                  ? ' koma-compare-modal__viewBtn--active'
                  : ''
              }`}
              aria-pressed={model.leftView === view}
              onClick={() => model.setViewMode(view)}
            >
              {t(VIEW_LABEL_KEYS[view])}
            </button>
          ))}
        </div>
        <span className="koma-compare-modal__zoom">
          {Math.round(model.zoom * 100)}%
        </span>
        <button
          type="button"
          className="koma-compare-modal__close"
          onClick={onClose}
          aria-label={t('dashboard.compareReview.close')}
        >
          <X size={14} />
        </button>
      </div>
      {model.image ? (
        <div ref={panesRef} className="koma-compare-modal__panes">
          <ComparePaneClassic model={model} view={model.leftView} />
          <ComparePaneClassic model={model} view={model.rightView} />
        </div>
      ) : (
        <div className="koma-compare-modal__empty">
          {t('dashboard.compareReview.empty')}
        </div>
      )}
      <div className="koma-compare-modal__footer">
        {t('dashboard.compareReview.hint')}
      </div>
    </KomaDialog>
  );
}

export default CompareReviewOverlayClassic;
