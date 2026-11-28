import { useEffect, useRef } from 'react';

import { preloadStageHeavyModules } from '../sections/StageGrid';
import { preloadSpecialWorkspaces } from '../../../components/dashboard/DashboardSpecialModeStage';
import { preloadInfoModeModules } from '../../../components/dashboard/DashboardInfoModeStage';
import { runWhenIdle } from '../../../utils/runWhenIdle';

export function useDashboardIdlePreload() {
  const scheduledRef = useRef(false);
  useEffect(() => {
    if (scheduledRef.current) return;
    scheduledRef.current = true;
    runWhenIdle(() => {
      preloadStageHeavyModules();
      preloadSpecialWorkspaces();
      preloadInfoModeModules();
    });
  }, []);
}
