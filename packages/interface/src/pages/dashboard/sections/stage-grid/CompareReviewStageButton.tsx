import { Columns2 } from 'lucide-react';

import { useI18n } from '../../../../i18n';
import { useThemeStore } from '@koma/ui/stores/theme-store';
import { useImageCollectionStore } from '../../stores/image-collection-store';
import { useUiShellStore } from '../../stores/ui-shell-store';

/**
 * Header button on a render-stage preview card: activates that page and opens
 * the compare-review overlay. Skin is derived in-place via the theme store
 * (same seam as AioRightPanel) because the stage-item renderer that mounts
 * this button is a plain function with no skin context.
 */
export default function CompareReviewStageButton({
  imageId,
}: {
  imageId: string;
}) {
  const { t } = useI18n();
  const noir = useThemeStore((s) => s.family === 'noir');
  const setActiveId = useImageCollectionStore((s) => s.setActiveId);
  const setCompareReviewOpen = useUiShellStore(
    (s) => s.setCompareReviewOpen,
  );

  const openCompare = (): void => {
    setActiveId(imageId);
    setCompareReviewOpen(true);
  };

  const label = t('dashboard.compareReview.openButton');

  if (noir) {
    return (
      <button
        type="button"
        onClick={openCompare}
        title={label}
        aria-label={label}
        className="panel-cut-sm grid h-6 w-6 place-items-center text-paper-dim transition-colors hover:bg-crimson hover:text-ink"
      >
        <Columns2 size={11} aria-hidden="true" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openCompare}
      title={label}
      aria-label={label}
      className="koma-iconbtn koma-iconbtn--xs koma-preview-card__historyBtn"
    >
      <Columns2 size={11} aria-hidden="true" />
    </button>
  );
}
