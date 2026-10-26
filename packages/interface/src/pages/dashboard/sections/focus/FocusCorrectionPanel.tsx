import { memo, useEffect, useRef, type KeyboardEvent } from 'react';
import { Check, Trash2 } from 'lucide-react';

import { useI18n } from '../../../../i18n';
import type { AioTextRegion } from '../../../../types/dashboard.types';
import type { FocusPageFlow } from '../../lib/focus-flow';

interface FocusCorrectionPanelProps {
  /** Flow state of the active page (null while no page is loaded). */
  pageFlow: FocusPageFlow | null;
  regions: AioTextRegion[];
  selectedRegionId: string | null;
  processing: boolean;
  reviewedPages: number;
  processedPages: number;
  onSelectRegion: (regionId: string | null) => void;
  onUpdateRegionText: (regionId: string, text: string) => void;
  onDeleteRegion: (regionId: string) => void;
  onToggleReviewed: () => void;
}

const regionDisplayText = (region: AioTextRegion): string =>
  region.renderText ?? region.translatedText ?? '';

/**
 * The "fix" surface of Focus: every bubble of the active page as
 * original → editable translation, bidirectionally synced with the
 * canvas selection. `Ctrl+Enter` walks the bubble list so a whole page
 * can be corrected without touching the mouse.
 */
export default memo(function FocusCorrectionPanel({
  pageFlow,
  regions,
  selectedRegionId,
  processing,
  reviewedPages,
  processedPages,
  onSelectRegion,
  onUpdateRegionText,
  onDeleteRegion,
  onToggleReviewed,
}: FocusCorrectionPanelProps) {
  const { t } = useI18n();
  const itemRefs = useRef(new Map<string, HTMLLIElement>());
  const inputRefs = useRef(new Map<string, HTMLTextAreaElement>());

  // Keep the canvas-driven selection visible in the list.
  useEffect(() => {
    if (!selectedRegionId) return;
    itemRefs.current
      .get(selectedRegionId)
      ?.scrollIntoView({ block: 'nearest' });
  }, [selectedRegionId]);

  const handleInputKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>,
    index: number,
  ) => {
    if (event.key !== 'Enter' || (!event.ctrlKey && !event.metaKey)) return;
    event.preventDefault();
    const next = regions[index + 1];
    if (!next) return;
    onSelectRegion(next.id);
    inputRefs.current.get(next.id)?.focus();
  };

  const processed = pageFlow?.processed ?? false;
  const emptyCount = pageFlow?.emptyRegionCount ?? 0;

  return (
    <aside className="koma-focus__panel" aria-label={t('focus.review.title')}>
      <div className="koma-focus__panel-head">
        <div className="koma-focus__panel-title-row">
          <h2 className="koma-focus__panel-title">{t('focus.review.title')}</h2>
          <button
            type="button"
            className={
              pageFlow?.reviewed
                ? 'koma-focus__btn koma-focus__btn--ok koma-focus__btn--sm'
                : 'koma-focus__btn koma-focus__btn--sm'
            }
            onClick={onToggleReviewed}
            disabled={!processed || processing}
            aria-pressed={pageFlow?.reviewed ?? false}
            title={
              pageFlow?.reviewed
                ? t('focus.review.unmark')
                : t('focus.review.markReviewed')
            }
          >
            <Check size={13} />
            {pageFlow?.reviewed
              ? t('focus.review.marked')
              : t('focus.review.markReviewed')}
          </button>
        </div>
        <div className="koma-focus__panel-meta">
          {processedPages > 0
            ? `${t('focus.review.progress', {
                reviewed: reviewedPages,
                total: processedPages,
              })} · ${t('focus.review.count', {
                regions: regions.length,
                empty: emptyCount,
              })}`
            : t('focus.review.count', {
                regions: regions.length,
                empty: emptyCount,
              })}
        </div>
      </div>

      {!processed ? (
        <div className="koma-focus__panel-empty">
          <p>{t('focus.review.runFirst')}</p>
        </div>
      ) : regions.length === 0 ? (
        <div className="koma-focus__panel-empty">
          <p>{t('focus.review.noRegions')}</p>
        </div>
      ) : (
        <ol className="koma-focus__fix-list custom-scrollbar">
          {regions.map((region, index) => {
            const value = regionDisplayText(region);
            const isEmpty = value.trim().length === 0;
            const isActive = region.id === selectedRegionId;
            return (
              <li
                key={region.id}
                ref={(node) => {
                  if (node) itemRefs.current.set(region.id, node);
                  else itemRefs.current.delete(region.id);
                }}
                className={[
                  'koma-focus__fix-item',
                  isActive ? 'koma-focus__fix-item--active' : '',
                  isEmpty ? 'koma-focus__fix-item--empty' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onSelectRegion(region.id)}
              >
                <div className="koma-focus__fix-head">
                  <span className="koma-focus__fix-index">#{index + 1}</span>
                  {region.sfxCandidate && (
                    <span className="koma-focus__chip">{t('focus.review.sfx')}</span>
                  )}
                  <button
                    type="button"
                    className="koma-focus__fix-delete"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteRegion(region.id);
                    }}
                    disabled={processing}
                    aria-label={t('focus.review.delete')}
                    title={t('focus.review.delete')}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <span className="koma-focus__fix-label">
                  {t('focus.review.source')}
                </span>
                <p className="koma-focus__fix-source" dir="auto">
                  {(region.recognizedText ?? '').trim() || '—'}
                </p>

                <label
                  className="koma-focus__fix-label"
                  htmlFor={`koma-focus-fix-${region.id}`}
                >
                  {t('focus.review.translation')}
                </label>
                <textarea
                  id={`koma-focus-fix-${region.id}`}
                  ref={(node) => {
                    if (node) inputRefs.current.set(region.id, node);
                    else inputRefs.current.delete(region.id);
                  }}
                  className="koma-focus__fix-input"
                  value={value}
                  rows={2}
                  dir="auto"
                  placeholder={t('focus.review.emptyPlaceholder')}
                  disabled={processing}
                  onFocus={() => onSelectRegion(region.id)}
                  onChange={(event) =>
                    onUpdateRegionText(region.id, event.target.value)
                  }
                  onKeyDown={(event) => handleInputKeyDown(event, index)}
                />
              </li>
            );
          })}
        </ol>
      )}

      {processed && regions.length > 0 && (
        <div className="koma-focus__panel-foot">
          {t('focus.review.nextBubbleHint')}
        </div>
      )}
    </aside>
  );
});
