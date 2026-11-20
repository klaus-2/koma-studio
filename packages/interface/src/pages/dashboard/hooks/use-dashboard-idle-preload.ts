import { useEffect, useRef } from 'react';

import { preloadStageHeavyModules } from '../sections/StageGrid';
import { preloadModeToolPanels } from '../sections/DashboardMainLayout';
import { preloadSpecialWorkspaces } from '../../../components/dashboard/DashboardSpecialModeStage';
import { preloadInfoModeModules } from '../../../components/dashboard/DashboardInfoModeStage';
import { runWhenIdle } from '../../../utils/runWhenIdle';

export function useDashboardIdlePreload() {
  const scheduledRef = useRef(false);
  useEffect(() => {
    // Optional workspaces are fetched on intent, never during boot: on slow
    // links those prefetches compete with the route chunk and the first paint.
    // The trigger is now the browser's own idle slot AFTER the initial load
    // settles (was: first pointerdown/keydown), so keyboard-first users warm
    // the same cache. runWhenIdle fires its callback exactly once per
    // schedule; the ref guard keeps StrictMode's double effect from
    // scheduling a second idle.
    if (scheduledRef.current) return;
    scheduledRef.current = true;
    runWhenIdle(() => {
      preloadStageHeavyModules();
      preloadModeToolPanels();
      preloadSpecialWorkspaces();
      preloadInfoModeModules();
    });
  }, []);
}
