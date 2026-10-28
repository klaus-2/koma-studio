import { useCallback, useState } from 'react';

import { desktopBridge } from '@/lib/desktop-bridge';
import type { useI18n } from '../../../i18n';
import { useToolTips } from '../../../hooks/useToolTips';
import { clearRendererStoredAppState } from '../../../utils/resetLocalAppState';
import {
  loadWorkspaceAutosaveSettings,
  saveWorkspaceAutosaveSettings,
  type WorkspaceAutosaveSettings,
} from '../../../utils/workspaceAutosaveSettings';
import type {
  LocalResetFeedbackState,
  WorkspaceAutosaveFeedbackState,
} from '../settings.types';

type TranslationFn = ReturnType<typeof useI18n>['t'];

export interface UseSettingsAppPreferencesArgs {
  t: TranslationFn;
}

export const useSettingsAppPreferences = ({ t }: UseSettingsAppPreferencesArgs) => {
  const [workspaceAutosaveSettings, setWorkspaceAutosaveSettings] =
    useState<WorkspaceAutosaveSettings>(() =>
      loadWorkspaceAutosaveSettings(),
    );
  const [localResetBusy, setLocalResetBusy] = useState(false);
  const [localResetFeedback, setLocalResetFeedback] =
    useState<LocalResetFeedbackState>(null);
  const [workspaceAutosaveFeedback, setWorkspaceAutosaveFeedback] =
    useState<WorkspaceAutosaveFeedbackState>(null);
  const { enabled: toolTipsEnabled, setEnabled: setToolTipsEnabled } =
    useToolTips();

  const handleSaveWorkspaceAutosaveSettings = useCallback(() => {
    const saved = saveWorkspaceAutosaveSettings(workspaceAutosaveSettings);
    setWorkspaceAutosaveSettings(saved);
    setWorkspaceAutosaveFeedback({
      type: "success",
      message: t("settings.app.autosave.success"),
    });
  }, [t, workspaceAutosaveSettings]);

  const handleResetLocalAppSettings = useCallback(async () => {
    const confirmed = window.confirm(t("settings.app.reset.confirm"));
    if (!confirmed) {
      return;
    }

    setLocalResetBusy(true);
    setLocalResetFeedback(null);

    try {
      clearRendererStoredAppState();

      if (desktopBridge.desktop?.resetLocalSettings) {
        await desktopBridge.desktop.resetLocalSettings();
      }

      setLocalResetFeedback({
        type: "success",
        message: t("settings.app.reset.success"),
      });

      if (desktopBridge.desktop?.restartApp) {
        await desktopBridge.desktop.restartApp();
        return;
      }

      window.setTimeout(() => {
        window.location.reload();
      }, 80);
    } catch (error) {
      setLocalResetFeedback({
        type: "error",
        message: error instanceof Error ? error.message : t("settings.app.autosave.error"),
      });
    } finally {
      setLocalResetBusy(false);
    }
  }, [t]);

  return {
    workspaceAutosaveSettings,
    setWorkspaceAutosaveSettings,
    setWorkspaceAutosaveFeedback,
    workspaceAutosaveFeedback,
    handleSaveWorkspaceAutosaveSettings,
    toolTipsEnabled,
    setToolTipsEnabled,
    localResetBusy,
    handleResetLocalAppSettings,
    localResetFeedback,
  };
};
