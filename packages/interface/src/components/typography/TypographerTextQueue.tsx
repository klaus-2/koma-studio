import { useRef, useCallback } from 'react';
import {
  ClipboardPaste,
  ListOrdered,
  FileUp,
  Eraser,
  SkipForward,
  CheckSquare,
  Rows3,
  ChevronUp,
  ChevronDown,
  GripVertical,
} from 'lucide-react';

import type { TextQueueItem } from '../../typography/types';
import './TypographerTextQueue.css';
import { AioSection } from '../../pages/AioSection';
import { useI18n } from '../../i18n';

interface MultiBubbleRegion {
  id: string;
  label: string;
}

// ponytail: stable module-scope default so `multiBubbleRegions = []` doesn't
// create a new array every render and defeat dependent useCallbacks.
const EMPTY_MULTI_BUBBLE_REGIONS: MultiBubbleRegion[] = [];

interface TypographerTextQueueProps {
  draftText: string;
  queue: TextQueueItem[];
  selectedQueueItemId: string | null;
  multiBubbleEnabled: boolean;
  onDraftTextChange: (value: string) => void;
  onBuildQueue: () => void;
  onClearQueue: () => void;
  onApplySelected: () => void;
  onApplyNext: () => void;
  onSelectQueueItem: (id: string | null) => void;
  onToggleMultiBubble: () => void;
  onImportText: (value: string) => void;
  multiBubbleRegions?: MultiBubbleRegion[];
  onReorderMultiBubbleRegions?: (nextOrder: string[]) => void;
}

export const TypographerTextQueue = ({
  draftText,
  queue,
  selectedQueueItemId,
  multiBubbleEnabled,
  onDraftTextChange,
  onBuildQueue,
  onClearQueue,
  onApplySelected,
  onApplyNext,
  onSelectQueueItem,
  onToggleMultiBubble,
  onImportText,
  multiBubbleRegions = EMPTY_MULTI_BUBBLE_REGIONS,
  onReorderMultiBubbleRegions,
}: TypographerTextQueueProps) => {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const dragIndexRef = useRef<number | null>(null);

  const moveBubble = useCallback(
    (fromIndex: number, delta: number) => {
      const toIndex = fromIndex + delta;
      if (toIndex < 0 || toIndex >= multiBubbleRegions.length) return;
      const nextOrder = multiBubbleRegions.map((r) => r.id);
      const [moved] = nextOrder.splice(fromIndex, 1);
      if (moved) nextOrder.splice(toIndex, 0, moved);
      onReorderMultiBubbleRegions?.(nextOrder);
    },
    [multiBubbleRegions, onReorderMultiBubbleRegions],
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      dragIndexRef.current = index;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
    },
    [],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();
      const fromIndex = dragIndexRef.current;
      if (fromIndex === null || fromIndex === dropIndex) return;
      const nextOrder = multiBubbleRegions.map((r) => r.id);
      const [moved] = nextOrder.splice(fromIndex, 1);
      if (moved) nextOrder.splice(dropIndex, 0, moved);
      onReorderMultiBubbleRegions?.(nextOrder);
      dragIndexRef.current = null;
    },
    [multiBubbleRegions, onReorderMultiBubbleRegions],
  );

  const showBubbleOrder = multiBubbleEnabled && multiBubbleRegions.length > 0;

  return (
    <AioSection
      icon={Rows3}
      title={t('typo.queue.title')}
      badge={
        queue.length > 0 ? (
          <span className="koma-aio-section__badge">{queue.length}</span>
        ) : undefined
      }
    >
      <div className="koma-text-queue">
        {/* Editor */}
        <textarea
          className="koma-text-queue__editor"
          value={draftText}
          onChange={(e) => onDraftTextChange(e.target.value)}
          placeholder={t('typo.queue.editorPlaceholder')}
          rows={6}
          aria-label={t('typo.queue.editorAria')}
        />

        {/* Build + Import */}
        <div className="koma-text-queue__actions">
          <button
            type="button"
            className="koma-btn koma-btn--ghost"
            onClick={onBuildQueue}
          >
            <ListOrdered size={11} /> {t('typo.queue.build')}
          </button>
          <button
            type="button"
            className="koma-btn koma-btn--ghost"
            onClick={() => fileRef.current?.click()}
          >
            <FileUp size={11} /> {t('typo.queue.import')}
          </button>
          <button
            type="button"
            className="koma-btn koma-btn--ghost"
            onClick={onApplySelected}
            disabled={!queue.length}
          >
            <CheckSquare size={11} /> {t('typo.queue.applySelected')}
          </button>
          <button
            type="button"
            className="koma-btn koma-btn--ghost"
            onClick={onApplyNext}
            disabled={!queue.length}
          >
            <SkipForward size={11} /> {t('typo.queue.next')}
          </button>
        </div>

        {/* Toggle + Clear */}
        <div className="koma-text-queue__control-row">
          <label className="koma-text-queue__toggle">
            <input
              type="checkbox"
              checked={multiBubbleEnabled}
              onChange={onToggleMultiBubble}
            />
            <span>{t('typo.queue.multiBubble')}</span>
          </label>
          <button
            type="button"
            className="koma-btn koma-btn--ghost koma-btn--sm"
            onClick={onClearQueue}
            disabled={!queue.length && !draftText.trim().length}
          >
            <Eraser size={10} /> {t('typo.queue.clear')}
          </button>
        </div>

        {/* Bubble Order Panel */}
        {showBubbleOrder && (
          <div className="koma-bubble-order">
            <div className="koma-bubble-order__header">
              <span className="koma-bubble-order__title">Bubble Order</span>
              <span className="koma-bubble-order__count">
                {multiBubbleRegions.length}
              </span>
            </div>
            <div className="koma-bubble-order__list">
              {multiBubbleRegions.map((region, idx) => {
                const pendingItem = queue.filter((q) => q.status === 'pending')[idx];
                return (
                  <div
                    key={region.id}
                    className="koma-bubble-order__item"
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, idx)}
                  >
                    <span className="koma-bubble-order__grip" title="Drag to reorder">
                      <GripVertical size={10} />
                    </span>
                    <span className="koma-bubble-order__badge">{idx + 1}</span>
                    <span className="koma-bubble-order__label" title={region.label}>
                      {region.label}
                    </span>
                    {pendingItem && (
                      <span
                        className="koma-bubble-order__queue-hint"
                        title={pendingItem.text}
                      >
                        &larr; {pendingItem.text.slice(0, 18)}
                      </span>
                    )}
                    <span className="koma-bubble-order__arrows">
                      <button
                        type="button"
                        className="koma-bubble-order__arrow"
                        disabled={idx === 0}
                        onClick={() => moveBubble(idx, -1)}
                        aria-label="Move up"
                      >
                        <ChevronUp size={12} />
                      </button>
                      <button
                        type="button"
                        className="koma-bubble-order__arrow"
                        disabled={idx === multiBubbleRegions.length - 1}
                        onClick={() => moveBubble(idx, 1)}
                        aria-label="Move down"
                      >
                        <ChevronDown size={12} />
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Queue list */}
        <div
          className="koma-text-queue__list"
          role="list"
          aria-label={t('typo.queue.listAria')}
        >
          {queue.length === 0 ? (
            <div className="koma-text-queue__empty">
              <ClipboardPaste size={16} />
              <p>{t('typo.queue.emptyTitle')}</p>
              <span>{t('typo.queue.emptyDesc')}</span>
            </div>
          ) : (
            queue.map((item, idx) => {
              const sel = selectedQueueItemId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`koma-text-queue__item${sel ? ' koma-text-queue__item--active' : ''}`}
                  onClick={() => onSelectQueueItem(item.id)}
                  role="listitem"
                  aria-pressed={sel}
                >
                  <span className="koma-text-queue__item-index">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="koma-text-queue__item-text">
                    {item.text}
                  </span>
                  <span
                    className={`koma-text-queue__status koma-text-queue__status--${item.status}`}
                  >
                    {item.status === 'applied'
                      ? t('typo.queue.statusApplied')
                      : item.status === 'skipped'
                        ? t('typo.queue.statusSkipped')
                        : t('typo.queue.statusPending')}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".txt,.md,text/plain,text/markdown"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            onImportText(await f.text());
            e.currentTarget.value = '';
          }}
        />
      </div>
    </AioSection>
  );
};
