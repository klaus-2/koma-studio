import { useEffect } from 'react';

import { preloadStageHeavyModules } from '../sections/StageGrid';
import { preloadModeToolPanels } from '../sections/DashboardMainLayout';
import { preloadSpecialWorkspaces } from '../../../components/dashboard/DashboardSpecialModeStage';
import { preloadInfoModeModules } from '../../../components/dashboard/DashboardInfoModeStage';

export function useDashboardIdlePreload() {
  useEffect(() => {
    // Optional workspaces are fetched on intent, never during boot: on slow
    // links those prefetches compete with the route chunk and the first paint.
    const preload = () => {
      preloadStageHeavyModules();
      preloadModeToolPanels();
      preloadSpecialWorkspaces();
      preloadInfoModeModules();
    };

    window.addEventListener('pointerdown', preload, { once: true, passive: true });
    window.addEventListener('keydown', preload, { once: true });
    return () => {
      window.removeEventListener('pointerdown', preload);
      window.removeEventListener('keydown', preload);
    };
  }, []);
}
