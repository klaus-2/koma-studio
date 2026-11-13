import { memo, useMemo } from 'react';

import { useI18n } from '../../../i18n';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useTranslatorStore } from '../stores/translator-store';
import { aioPanelClasses } from './AioRightPanel.skin';

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
  const detectionsByImage = useTranslatorStore(
    (s) => s.translatorDetectionsByImage,
  );

  const { tmHits, regionCount } = useMemo(() => {
    const regions =
      activeId === null ? [] : (detectionsByImage[activeId] ?? []);
    return {
      tmHits: regions.filter((region) => region.translationSource === 'tm').length,
      regionCount: regions.length,
    };
  }, [activeId, detectionsByImage]);

  return (
    <p className={aioPanelClasses(noir).hint}>
      {t('dashboard.aio.translation.tmHitCount', {
        hits: tmHits,
        total: regionCount,
      })}
    </p>
  );
});
