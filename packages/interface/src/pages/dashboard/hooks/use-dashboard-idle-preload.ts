import { useEffect } from 'react';

import { preloadStageHeavyModules } from '../sections/StageGrid';
import { preloadModeToolPanels } from '../sections/DashboardMainLayout';
import { preloadSpecialWorkspaces } from '../../../components/dashboard/DashboardSpecialModeStage';
import { preloadInfoModeModules } from '../../../components/dashboard/DashboardInfoModeStage';

const IDLE_FALLBACK_TIMEOUT_MS = 1500;

function scheduleIdle(callback: () => void): number {
  if (typeof window.requestIdleCallback === 'function') {
    return window.requestIdleCallback(callback, {
      timeout: IDLE_FALLBACK_TIMEOUT_MS,
    });
  }
  return window.setTimeout(callback, IDLE_FALLBACK_TIMEOUT_MS) as unknown as number;
}

function cancelIdle(handle: number) {
  if (typeof window.cancelIdleCallback === 'function') {
    window.cancelIdleCallback(handle);
  } else {
    window.clearTimeout(handle);
  }
}

export function useDashboardIdlePreload() {
  useEffect(() => {
    const handle = scheduleIdle(() => {
      preloadStageHeavyModules();
      preloadModeToolPanels();
      preloadSpecialWorkspaces();
      preloadInfoModeModules();
    });
    return () => cancelIdle(handle);
  }, []);
}
