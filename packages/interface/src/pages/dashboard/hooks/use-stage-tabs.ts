import { useMemo } from 'react';
import {
  Languages,
  Eraser,
  Eye,
  ScanText,
  Replace,
  Paintbrush,
} from 'lucide-react';

import { useI18n } from '../../../i18n';
import type { StageTabDef } from '../../AioStageTabBar';

/** Stage tabs for the AIO stage bar, labelled through the active locale. */
export function useStageTabs(): StageTabDef[] {
  const { t } = useI18n();
  const STAGE_TABS: StageTabDef[] = useMemo(
    () =>
      [
        {
          key: 'detectText',
          icon: ScanText,
          label: t('dashboard.stage.detectText.label'),
          shortLabel: t('dashboard.stage.detectText.short'),
        },
        {
          key: 'recognizeText',
          icon: Eye,
          label: t('dashboard.stage.recognizeText.label'),
          shortLabel: t('dashboard.stage.recognizeText.short'),
        },
        {
          key: 'getTranslations',
          icon: Languages,
          label: t('dashboard.stage.getTranslations.label'),
          shortLabel: t('dashboard.stage.getTranslations.short'),
        },
        {
          key: 'segmentText',
          icon: Replace,
          label: t('dashboard.stage.segmentText.label'),
          shortLabel: t('dashboard.stage.segmentText.short'),
        },
        {
          key: 'cleanImage',
          icon: Eraser,
          label: t('dashboard.stage.cleanImage.label'),
          shortLabel: t('dashboard.stage.cleanImage.short'),
        },
        {
          key: 'render',
          icon: Paintbrush,
          label: t('dashboard.stage.render.label'),
          shortLabel: t('dashboard.stage.render.short'),
        },
      ] as StageTabDef[],
    [t],
  );

  return STAGE_TABS;
}
