import { memo } from 'react';
import { Pencil, X } from 'lucide-react';

import { useI18n } from '../../i18n';
import { cn } from '../../utils/dashboard.utils';
import { useImageCollectionStore } from '@/pages/dashboard/stores/image-collection-store';
import { useStatusStore } from '@/pages/dashboard/stores/status-store';
import { useUiShellStore } from '@/pages/dashboard/stores/ui-shell-store';

interface SidebarChapterHeaderProps {
  /** Null for the implicit group of images without a chapter. */
  readonly chapterId: string | null;
  readonly label: string;
  readonly count: number;
  readonly noir: boolean;
}

/**
 * Chapter divider in the file list. Real chapters can be renamed or removed;
 * both actions only rewrite the chapter label on their images.
 */
export default memo(function SidebarChapterHeader({
  chapterId,
  label,
  count,
  noir,
}: SidebarChapterHeaderProps) {
  const { t } = useI18n();
  const renameChapter = useImageCollectionStore((state) => state.renameChapter);
  const clearChapter = useImageCollectionStore((state) => state.clearChapter);
  const setStatusMessage = useStatusStore((state) => state.setStatusMessage);
  const processing = useUiShellStore((state) => state.processing);
  const buttonClass = noir
    ? 'grid h-5 w-5 place-items-center text-paper-dim transition-colors hover:bg-crimson hover:text-ink disabled:cursor-not-allowed disabled:opacity-30'
    : 'koma-iconbtn koma-iconbtn--xs';

  const rename = (): void => {
    if (!chapterId) {
      return;
    }

    const requested = window.prompt(
      t('dashboard.sidebar.chapters.renamePrompt'),
      label,
    );
    const nextLabel = requested?.trim();

    if (!nextLabel || nextLabel === label) {
      return;
    }

    renameChapter(chapterId, nextLabel);
    setStatusMessage(
      t('dashboard.sidebar.chapters.renamed', { name: nextLabel }),
    );
  };

  const remove = (): void => {
    if (!chapterId) {
      return;
    }

    if (
      !window.confirm(
        t('dashboard.sidebar.chapters.removeConfirm', { name: label }),
      )
    ) {
      return;
    }

    clearChapter(chapterId);
    setStatusMessage(
      t('dashboard.sidebar.chapters.removed', { name: label, count }),
    );
  };

  return (
    <div
      className={cn(
        'flex w-full items-center gap-1',
        noir
          ? 'border-b border-paper/10 pb-1 font-mono text-[9px] uppercase tracking-[0.12em] text-paper-dim'
          : 'px-1 py-1 text-[10px] font-semibold',
      )}
      data-chapter-id={chapterId ?? 'direct-images'}
    >
      <span className="min-w-0 flex-1 truncate" title={label}>
        {label}
      </span>
      <span className="shrink-0 opacity-60">{count}</span>
      {chapterId && (
        <>
          <button
            type="button"
            className={buttonClass}
            onClick={rename}
            disabled={processing}
            title={t('dashboard.sidebar.chapters.rename')}
            aria-label={t('dashboard.sidebar.chapters.rename')}
          >
            <Pencil size={10} />
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={remove}
            disabled={processing}
            title={t('dashboard.sidebar.chapters.remove')}
            aria-label={t('dashboard.sidebar.chapters.remove')}
          >
            <X size={11} />
          </button>
        </>
      )}
    </div>
  );
});
