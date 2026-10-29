import DashboardEmptyStageClassic from './DashboardEmptyStageClassic';
import DashboardEmptyStageNoir from './noir/DashboardEmptyStageNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';
import { memo, useEffect, useMemo } from "react";
import { useI18n } from '../../i18n';
import {
  EMPTY_PREVIEW_TIP_ROTATION_MS,
  getEmptyPreviewTips,
} from '../../constants/dashboard.constants';
import { useUiShellStore } from '../../pages/dashboard/stores/ui-shell-store';

const DashboardEmptyStageFamilies = createFamilyComponent(
  DashboardEmptyStageClassic,
  DashboardEmptyStageNoir,
);

/**
 * Leaf owner of the tip rotation: mounted only while the stage is empty, so
 * the interval and the store subscription never re-render anything above it.
 */
const DashboardEmptyStage = memo(function DashboardEmptyStage() {
  const { t } = useI18n();
  const emptyPreviewTips = useMemo(() => getEmptyPreviewTips(t), [t]);
  const emptyPreviewTipIndex = useUiShellStore((s) => s.emptyPreviewTipIndex);
  const setEmptyPreviewTipIndex = useUiShellStore(
    (s) => s.setEmptyPreviewTipIndex,
  );

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setEmptyPreviewTipIndex((prev) => (prev + 1) % emptyPreviewTips.length);
    }, EMPTY_PREVIEW_TIP_ROTATION_MS);
    return () => window.clearInterval(intervalId);
  }, [setEmptyPreviewTipIndex, emptyPreviewTips]);

  return (
    <DashboardEmptyStageFamilies
      emptyPreviewTipIndex={emptyPreviewTipIndex}
      currentEmptyPreviewTip={
        emptyPreviewTips[emptyPreviewTipIndex % emptyPreviewTips.length] ?? ''
      }
    />
  );
});

export default DashboardEmptyStage;
