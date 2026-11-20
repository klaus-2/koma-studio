import { memo, useMemo } from 'react';

import { useI18n } from '../../../i18n';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useTranslatorStore } from '../stores/translator-store';
import { aioPanelClasses } from './AioRightPanel.skin';
import type { AioTextRegion } from '../../../types/dashboard.types';

const EMPTY_TRANSLATOR_REGIONS: AioTextRegion[] = [];

interface TmHitCountBadgeProps {
  noir: boolean;
}

// SKIN-AGNOSTIC section (noir-prop mechanism, aioPanelClasses — no Classic/Noir
// twins): derived readout of how many regions of the active image's last
// translation run were served from the translation memory. Counts are derived
// from the existing translatorDetectionsByImage map — no new state.
export default memo(function TmHitCountBadge({ noir }: TmHitCountBadgeProps) {
  const { t } = useI18n();
  const activeId = useImageCollectionStore((s) => s.activeId);
  // Per-id subscription: only the active image's array identity (CoW) can
  // re-render this badge — edits on other images keep their array identity.
  const activeRegions = useTranslatorStore((s) =>
    activeId === null
      ? EMPTY_TRANSLATOR_REGIONS
      : (s.translatorDetectionsByImage[activeId] ?? EMPTY_TRANSLATOR_REGIONS),
  );

  const { tmHits, regionCount } = useMemo(() => {
    return {
      tmHits: activeRegions.filter((region) => region.translationSource === 'tm').length,
      regionCount: activeRegions.length,
    };
  }, [activeRegions]);

  return (
    <p className={aioPanelClasses(noir).hint}>
      {t('dashboard.aio.translation.tmHitCount', {
        hits: tmHits,
        total: regionCount,
      })}
    </p>
  );
});
