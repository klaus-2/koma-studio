import { useCallback, useEffect, useMemo, useState } from 'react';

import { desktopBridge } from '@/lib/desktop-bridge';
import type { useI18n } from '../../../i18n';
import type {
  DesktopMiniBackendRuntimeArtifactOption,
  DesktopMiniBackendRuntimeState,
  DesktopRuntimeConfig,
} from '../../../types';
import { formatRuntimeProfileLabel } from '../settings.constants';

type TranslationFn = ReturnType<typeof useI18n>['t'];

export interface UseSettingsRuntimeInstallArgs {
  t: TranslationFn;
}

export const useSettingsRuntimeInstall = ({ t }: UseSettingsRuntimeInstallArgs) => {
  const runtimeConfig = useMemo<DesktopRuntimeConfig | null>(() => {
    if (typeof window === "undefined" || !desktopBridge.desktop) {
      return null;
    }

    return desktopBridge.desktop.getRuntimeConfig();
  }, []);

  const [runtimeState, setRuntimeState] = useState<DesktopMiniBackendRuntimeState | null>(null);
  const [runtimeInstallBusy, setRuntimeInstallBusy] = useState(false);
  const [runtimeInstallMode, setRuntimeInstallMode] = useState<"manual" | null>(null);
  const [runtimeInstallFeedback, setRuntimeInstallFeedback] = useState<string | null>(null);
  const [runtimeInstallError, setRuntimeInstallError] = useState<string | null>(null);
  const [runtimeArtifactOptions, setRuntimeArtifactOptions] = useState<DesktopMiniBackendRuntimeArtifactOption[]>([]);
  const [selectedRuntimeArtifactProfile, setSelectedRuntimeArtifactProfile] = useState<string>("cpu");

  const runtimeInstallInProgress = runtimeState
    ? ["resolving", "checking", "downloading", "verifying", "extracting"].includes(runtimeState.status)
    : false;
  const runtimeInstallButtonLabel = (() => {
    if (!runtimeInstallBusy && !runtimeInstallInProgress) {
      return "Install selected profile";
    }

    if (runtimeState?.status === "downloading" && runtimeState.progress) {
      return `Downloading ${Math.round(runtimeState.progress.percent)}%`;
    }

    return runtimeState?.statusMessage ?? "Preparing runtime artifact...";
  })();
  const runtimeArtifactsAvailable = Boolean(runtimeConfig?.appPackaged && runtimeConfig.runtimeArtifactsUrl);
  const runtimeArtifactsAvailabilityLabel = runtimeConfig?.appPackaged
    ? (runtimeConfig.runtimeArtifactsUrl
      ? "Packaged app with runtime artifacts available"
      : "Packaged app without runtime artifact source configured")
    : "Unavailable in development mode";
  const recommendedRuntimeArtifact = runtimeArtifactOptions.find((entry) => entry.recommended) ?? null;
  const recommendedRuntimeProfile = recommendedRuntimeArtifact?.profile ?? runtimeState?.requestedProfile ?? "cpu";
  const loadRuntimeArtifactOptions = useCallback(async () => {
    if (!desktopBridge.desktop?.listMiniBackendRuntimeArtifacts || !runtimeConfig?.appPackaged || !runtimeConfig.runtimeArtifactsUrl) {
      setRuntimeArtifactOptions([]);
      return;
    }

    try {
      const options = await desktopBridge.desktop.listMiniBackendRuntimeArtifacts();
      setRuntimeArtifactOptions(options);
      setSelectedRuntimeArtifactProfile((currentValue) => {
        if (options.some((entry) => entry.profile === currentValue)) {
          return currentValue;
        }
        const recommended = options.find((entry) => entry.recommended);
        return recommended?.profile ?? options[0]?.profile ?? "cpu";
      });
    } catch {
      setRuntimeArtifactOptions([]);
    }
  }, [runtimeConfig?.appPackaged, runtimeConfig?.runtimeArtifactsUrl]);

  useEffect(() => {
    if (!desktopBridge.desktop) {
      return;
    }

    let cancelled = false;
    const listener = (payload: DesktopMiniBackendRuntimeState) => {
      if (!cancelled) {
        setRuntimeState(payload);
      }
    };

    void desktopBridge.desktop.getMiniBackendRuntimeState()
      .then((payload) => {
        if (!cancelled) {
          setRuntimeState(payload ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRuntimeState(null);
        }
      });

    desktopBridge.desktop.onMiniBackendRuntimeState(listener);
    return () => {
      cancelled = true;
      desktopBridge.desktop?.offMiniBackendRuntimeState(listener);
    };
  }, []);

  useEffect(() => {
    void loadRuntimeArtifactOptions();
  }, [loadRuntimeArtifactOptions]);

  const handleUseRecommendedRuntimeProfile = useCallback((profile: string) => {
    setSelectedRuntimeArtifactProfile(profile);
    setRuntimeInstallFeedback(`Selected ${formatRuntimeProfileLabel(profile)} for manual installation.`);
    setRuntimeInstallError(null);
  }, [formatRuntimeProfileLabel]);

  const handleInstallSelectedRuntimeProfile = useCallback(async () => {
    setRuntimeInstallFeedback(null);
    setRuntimeInstallError(null);
    setRuntimeInstallMode("manual");

    if (!desktopBridge.desktop?.installMiniBackendRuntimeProfile) {
      setRuntimeInstallError(t("settings.app.updater.desktopOnly"));
      setRuntimeInstallMode(null);
      return;
    }

    if (!runtimeConfig?.appPackaged) {
      setRuntimeInstallError("Manual runtime artifact install is only available in the packaged app.");
      setRuntimeInstallMode(null);
      return;
    }

    if (!selectedRuntimeArtifactProfile) {
      setRuntimeInstallError("Select a runtime profile before installing.");
      setRuntimeInstallMode(null);
      return;
    }

    setRuntimeInstallBusy(true);
    try {
      const result = await desktopBridge.desktop.installMiniBackendRuntimeProfile(selectedRuntimeArtifactProfile);
      if (result.ok) {
        setRuntimeInstallFeedback(`${formatRuntimeProfileLabel(result.profile)} runtime installed and activated.`);
        await loadRuntimeArtifactOptions();
        return;
      }

      setRuntimeInstallError(result.reason || "Failed to install the selected runtime artifact.");
    } catch (error) {
      setRuntimeInstallError(error instanceof Error ? error.message : "Failed to install the selected runtime artifact.");
    } finally {
      setRuntimeInstallBusy(false);
      setRuntimeInstallMode(null);
    }
  }, [loadRuntimeArtifactOptions, runtimeConfig?.appPackaged, selectedRuntimeArtifactProfile, t]);

  return {
    runtimeState,
    recommendedRuntimeProfile,
    runtimeArtifactsAvailable,
    runtimeArtifactsAvailabilityLabel,
    runtimeInstallBusy,
    runtimeInstallInProgress,
    runtimeInstallMode,
    runtimeInstallButtonLabel,
    runtimeInstallFeedback,
    runtimeInstallError,
    runtimeArtifactOptions,
    selectedRuntimeArtifactProfile,
    setSelectedRuntimeArtifactProfile,
    handleUseRecommendedRuntimeProfile,
    handleInstallSelectedRuntimeProfile,
  };
};
