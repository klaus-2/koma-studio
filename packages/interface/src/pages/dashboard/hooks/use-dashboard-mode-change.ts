import { useCallback } from 'react';

import {
  INFO_MODES,
  isModeUnderDevelopment,
} from '../../../constants/dashboard.constants';
import type { getModeLabels } from '../../../constants/dashboard.constants';
import type { useDashboardMenus } from '../../../hooks/useDashboardMenus';
import type { useDashboardShellLayout } from '../../../hooks/useDashboardShellLayout';
import { useI18n } from '../../../i18n';
import type { ToolMode } from '../../../types/dashboard.types';
import type { useStatusStore } from '../stores/status-store';
import type { useUiShellStore } from '../stores/ui-shell-store';

type ModeLabels = ReturnType<typeof getModeLabels>;
type UiShellState = ReturnType<typeof useUiShellStore.getState>;
type StatusState = ReturnType<typeof useStatusStore.getState>;
type ShellLayoutApi = ReturnType<typeof useDashboardShellLayout>;
type DashboardMenusApi = ReturnType<typeof useDashboardMenus>;

export interface UseDashboardModeChangeArgs {
  readonly modeLabels: ModeLabels;
  readonly t: ReturnType<typeof useI18n>['t'];
  readonly underDevelopmentTooltip: string;
  readonly setMode: UiShellState['setMode'];
  readonly setSubMode: UiShellState['setSubMode'];
  readonly setTonedStatus: StatusState['setTonedStatus'];
  readonly setStatusMessage: StatusState['setStatusMessage'];
  readonly setMobileNavOpen: ShellLayoutApi['setMobileNavOpen'];
  readonly setMobileToolsOpen: ShellLayoutApi['setMobileToolsOpen'];
  readonly setUtilsMenuOpen: DashboardMenusApi['setUtilsMenuOpen'];
  readonly setDownloadMenuOpen: DashboardMenusApi['setDownloadMenuOpen'];
}

/** Mode switch: refuses modes still under development and closes open menus. */
export function useDashboardModeChange({
  modeLabels,
  t,
  underDevelopmentTooltip,
  setMode,
  setSubMode,
  setTonedStatus,
  setStatusMessage,
  setMobileNavOpen,
  setMobileToolsOpen,
  setUtilsMenuOpen,
  setDownloadMenuOpen,
}: UseDashboardModeChangeArgs): (newMode: ToolMode) => void {
  const handleModeChange = useCallback(
    (newMode: ToolMode) => {
      if (isModeUnderDevelopment(newMode)) {
        setTonedStatus(
          t('dashboard.status.underDevelopment', {
            mode: modeLabels[newMode],
            tooltip: underDevelopmentTooltip,
          }),
          'error',
        );
        return;
      }
      setMode(newMode);
      if (newMode === 'typesetter') {
        setSubMode('manual');
      }
      setMobileNavOpen(false);
      setMobileToolsOpen(false);
      setUtilsMenuOpen(false);
      setDownloadMenuOpen(false);
      if (!INFO_MODES.includes(newMode)) {
        setStatusMessage(
          t('dashboard.status.modeChanged', {
            mode: modeLabels[newMode],
          }),
        );
      }
    },
    [
      modeLabels,
      setMode,
      setStatusMessage,
      setSubMode,
      setTonedStatus,
      t,
      underDevelopmentTooltip,
    ],
  );

  return handleModeChange;
}
