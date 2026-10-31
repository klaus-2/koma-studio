import { memo } from 'react';

import { useI18n } from '../../i18n';
import { cn } from '../../utils/dashboard.utils';
import type { SidebarChapterSelection } from '@/pages/dashboard/hooks/use-sidebar-chapter-selection';

interface SidebarChapterSelectionBarProps {
  readonly selection: SidebarChapterSelection;
  readonly noir: boolean;
}

/**
 * Selection toolbar shared by both sidebar skins: count, create/clear chapter
 * and cancel. Sits between the file-list header and the list.
 */
export default memo(function SidebarChapterSelectionBar({
  selection,
  noir,
}: SidebarChapterSelectionBarProps) {
  const { t } = useI18n();
  const count = selection.selectedIds.size;
  const buttonClass = noir
    ? 'panel-cut-sm border border-paper/15 bg-ink-3 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-paper transition-colors hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-30'
    : 'koma-btn koma-btn--ghost koma-btn--sm';
  const disabled = selection.disabled;

  return (
    <div
      className={cn(
        'mb-1 flex flex-wrap items-center gap-1',
        noir ? 'font-mono text-[9px] text-paper-dim' : 'px-1 text-[10px]',
      )}
      data-tour="dashboard-chapter-selection"
    >
      <span className="mr-auto">
        {t('dashboard.sidebar.selection.selected', { count })}
      </span>
      <button
        type="button"
        className={buttonClass}
        onClick={selection.createChapter}
        disabled={disabled || count === 0}
      >
        {t('dashboard.sidebar.selection.create')}
      </button>
      <button
        type="button"
        className={buttonClass}
        onClick={selection.clearChapter}
        disabled={disabled || count === 0}
      >
        {t('dashboard.sidebar.selection.clear')}
      </button>
      <button
        type="button"
        className={buttonClass}
        onClick={selection.cancel}
      >
        {t('dashboard.sidebar.selection.cancel')}
      </button>
    </div>
  );
});
