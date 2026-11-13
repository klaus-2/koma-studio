import { useRef } from 'react';
import { Columns2, X } from 'lucide-react';

import { useI18n } from '../../../i18n';
import type { TranslationKey } from '../../../i18n/messages';
import type { CompareReviewView } from '../../../types/dashboard.types';
import { KomaDialog } from '@koma/ui/components/dialog';
import { useCompareReviewModel } from '../compare-review/useCompareReviewModel';
import type { CompareMaskPolygon } from '../compare-review/useCompareReviewModel';
import type { CompareReviewModel } from '../compare-review/useCompareReviewModel';
import type { CompareReviewOverlayProps } from '../CompareReviewOverlayClassic';

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

function ComparePaneNoir({
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
      className="group/pane relative m-0 flex min-w-0 flex-1 flex-col overflow-hidden border border-paper/10 bg-ink/70 panel-cut cursor-grab active:cursor-grabbing"
      onPointerDown={model.beginPan}
      onPointerMove={model.movePan}
      onPointerUp={model.endPan}
      onPointerCancel={model.endPan}
    >
      <figcaption className="flex shrink-0 items-center justify-between border-b border-paper/10 px-2.5 py-1.5">
        <span className="kicker">
          {'// '}
          {t(captionKey)}
        </span>
        <span className="font-mono text-[9px] text-paper/40">
          {image.width}&times;{image.height}
        </span>
      </figcaption>
      <div className="min-h-0 flex-1 overflow-hidden">
        <div
          className="relative origin-top-left"
          style={{
            width: image.width,
            height: image.height,
            transform: model.paneTransform,
          }}
        >
          <img
            src={
              view === 'rendered' ? model.previewSrc ?? undefined : image.url
            }
            alt={image.file.name}
            className="block select-none"
            width={image.width}
            height={image.height}
            draggable={false}
            decoding="async"
          />
          {view === 'rendered' && (
            <canvas
              ref={model.renderCanvasRef}
              className="absolute left-0 top-0"
              width={image.width}
              height={image.height}
            />
          )}
          {view === 'mask' && (
            <svg
              className="absolute left-0 top-0"
              width={image.width}
              height={image.height}
              viewBox={`0 0 ${image.width} ${image.height}`}
              aria-hidden="true"
            >
              {model.maskPolygons.map((polygon) => (
                <polygon
                  key={`mask-polygon-${polygon.regionId}`}
                  points={polygonPoints(polygon)}
                  fill="rgba(255, 46, 99, 0.28)"
                  stroke="#ff2e63"
                  strokeWidth={2}
                />
              ))}
            </svg>
          )}
        </div>
      </div>
    </figure>
  );
}

export default function CompareReviewOverlayNoir({
  onClose,
}: CompareReviewOverlayProps) {
  const { t } = useI18n();
  const panesRef = useRef<HTMLDivElement | null>(null);
  const model = useCompareReviewModel({ panesRef });

  return (
    <KomaDialog
      open
      onClose={onClose}
      layerClassName="fixed inset-0 z-[150] flex flex-col bg-ink/90 backdrop-blur-md"
      modalClassName="glass panel-cut halftone relative flex h-full w-full flex-col overflow-hidden"
      label={t('dashboard.compareReview.title')}
    >
      <span
        aria-hidden
        className="absolute left-0 top-0 z-10 h-[3px] w-full bg-gradient-to-r from-crimson via-crimson/40 to-transparent"
      />

      <header className="flex flex-wrap items-center gap-3 border-b border-paper/[0.065] px-4 py-3">
        <div className="flex items-center gap-3">
          <span
            className="panel-cut-sm grid size-9 place-items-center border border-azure/30 bg-azure/10 text-azure"
            aria-hidden="true"
          >
            <Columns2 size={15} />
          </span>
          <strong className="font-display text-base font-black uppercase tracking-[-0.03em] text-paper">
            {t('dashboard.compareReview.title')}
          </strong>
        </div>

        <div
          role="group"
          aria-label={t('dashboard.compareReview.title')}
          className="ml-auto flex items-center border border-paper/10 bg-ink/60 panel-cut-sm"
        >
          {VIEW_TOGGLE_ORDER.map((view) => (
            <button
              key={view}
              type="button"
              aria-pressed={model.leftView === view}
              onClick={() => model.setViewMode(view)}
              className={[
                'px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] transition-colors',
                model.leftView === view
                  ? 'bg-crimson/15 text-crimson'
                  : 'text-paper/45 hover:bg-paper/[0.05] hover:text-paper',
                view !== 'original' ? 'border-l border-paper/10' : '',
              ].join(' ')}
            >
              {t(VIEW_LABEL_KEYS[view])}
            </button>
          ))}
        </div>

        <span className="font-mono text-[10px] font-bold text-paper/55">
          {Math.round(model.zoom * 100)}%
        </span>

        <button
          type="button"
          onClick={onClose}
          aria-label={t('dashboard.compareReview.close')}
          className="panel-cut-sm grid size-8 place-items-center text-paper/45 transition-colors hover:bg-crimson hover:text-ink"
        >
          <X size={14} />
        </button>
      </header>

      <div
        ref={panesRef}
        className="flex min-h-0 flex-1 items-stretch gap-3 p-3"
      >
        {model.image ? (
          <>
            <ComparePaneNoir model={model} view={model.leftView} />
            <ComparePaneNoir model={model} view={model.rightView} />
          </>
        ) : (
          <div className="halftone grid w-full place-items-center bg-ink/50">
            <p className="font-mono text-xs uppercase tracking-[0.12em] text-paper/34">
              {t('dashboard.compareReview.empty')}
            </p>
          </div>
        )}
      </div>

      <footer className="border-t border-paper/10 px-4 py-2 font-mono text-[9px] text-paper/45">
        {t('dashboard.compareReview.hint')}
      </footer>
    </KomaDialog>
  );
}
