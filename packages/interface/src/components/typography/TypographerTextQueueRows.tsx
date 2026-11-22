import { memo } from 'react';
import { m } from 'framer-motion';

import type { TextQueueItem } from '../../typography/types';
import { useI18n } from '../../i18n';
import { EASE } from '../system/v2/kit';

export interface TypographerQueueRowProps {
  item: TextQueueItem;
  index: number;
  selected: boolean;
  onSelect: (id: string) => void;
}

const ROW_MOTION = {
  initial: { opacity: 0, x: -8 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 8 },
  transition: { duration: 0.2, ease: EASE },
};

const STATUS_CHIP: Record<TextQueueItem['status'], string> = {
  applied: 'border-mint/50 bg-mint/10 text-mint',
  skipped: 'border-paper/20 bg-paper/5 text-paper/40',
  pending: 'border-gold/50 bg-gold/10 text-gold',
};

export const TypographerQueueRowClassic = memo(function TypographerQueueRowClassic({
  item,
  index,
  selected,
  onSelect,
}: TypographerQueueRowProps) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      className={`koma-text-queue__item${selected ? ' koma-text-queue__item--active' : ''}`}
      onClick={() => onSelect(item.id)}
      role="listitem"
      aria-pressed={selected}
    >
      <span className="koma-text-queue__item-index">
        {String(index + 1).padStart(2, '0')}
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
});

export const TypographerQueueRowNoir = memo(function TypographerQueueRowNoir({
  item,
  index,
  selected,
  onSelect,
}: TypographerQueueRowProps) {
  const { t } = useI18n();
  const statusLabel = item.status === 'applied'
    ? t('typo.queue.statusApplied')
    : item.status === 'skipped'
      ? t('typo.queue.statusSkipped')
      : t('typo.queue.statusPending');
  return (
    <m.button
      type="button"
      role="listitem"
      aria-pressed={selected}
      {...ROW_MOTION}
      onClick={() => onSelect(item.id)}
      className={`panel-cut-sm relative flex w-full items-center gap-2 border px-2.5 py-2 text-left transition-colors ${selected ? 'border-crimson/50 bg-crimson/[0.06]'
        : item.status === 'applied' ? 'border-paper/8 bg-ink/40 opacity-60'
          : 'border-paper/10 bg-ink/60 hover:border-paper/25'
        }`}
    >
      {selected && <span aria-hidden className="absolute left-0 top-0 h-full w-[2px] bg-crimson" />}
      <span aria-hidden className={`font-display text-xs font-black ${selected ? 'text-crimson' : 'text-paper/25'}`}>
        {String(index + 1).padStart(2, '0')}
      </span>
      <span className={`min-w-0 flex-1 truncate font-mono text-[10px] ${item.status === 'applied' ? 'text-paper/40 line-through' : 'text-paper/80'
        }`}>
        {item.text}
      </span>
      <span className={`shrink-0 border px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em] ${STATUS_CHIP[item.status]}`}>
        {item.status === 'pending' && <span className="blink mr-0.5">●</span>}
        {statusLabel}
      </span>
    </m.button>
  );
});
