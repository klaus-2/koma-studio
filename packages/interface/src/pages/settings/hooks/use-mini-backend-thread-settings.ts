import { useCallback, useMemo, useState } from 'react';

import { desktopBridge } from '@/lib/desktop-bridge';
import {
  loadMiniBackendThreadSettings,
  saveMiniBackendThreadSettings,
  type MiniBackendThreadSettings,
} from '../../../utils/miniBackendThreadSettings';

export interface MiniBackendTunablesSettings {
  engineIdleTimeoutSeconds: number;
  workingResolutionMegapixels: number;
  workingResolutionOcrClean: boolean;
}

const bridgePayloadFor = (saved: MiniBackendThreadSettings) => ({
  intraOpThreads: saved.intraOpThreads,
  engineIdleTimeoutSeconds: saved.engineIdleTimeoutSeconds,
  workingResolutionMegapixels: saved.workingResolutionMegapixels,
  workingResolutionOcrClean: saved.workingResolutionOcrClean,
});

export const useMiniBackendThreadSettings = () => {
  const [settings, setSettings] = useState<MiniBackendThreadSettings>(() =>
    loadMiniBackendThreadSettings(),
  );
  const [miniBackendTunables, setMiniBackendTunables] =
    useState<MiniBackendTunablesSettings>(() => ({
      engineIdleTimeoutSeconds: settings.engineIdleTimeoutSeconds,
      workingResolutionMegapixels: settings.workingResolutionMegapixels,
      workingResolutionOcrClean: settings.workingResolutionOcrClean,
    }));
  const hardwareConcurrency =
    typeof navigator !== 'undefined' && navigator.hardwareConcurrency > 0
      ? navigator.hardwareConcurrency
      : null;

  const setIntraOpThreads = useCallback(
    (value: number | null) => {
      const saved = saveMiniBackendThreadSettings({
        ...settings,
        intraOpThreads: value,
      });
      setSettings(saved);
      // Dev web has no desktop bridge: the override file is shell-side only.
      void desktopBridge.desktop
        ?.setMiniBackendThreadOverride(bridgePayloadFor(saved))
        .catch((error: unknown) => {
          console.debug('mini-backend thread override not delivered', error);
        });
    },
    [settings],
  );

  const handleSaveMiniBackendTunables = useCallback(() => {
    const saved = saveMiniBackendThreadSettings({
      ...settings,
      ...miniBackendTunables,
    });
    setSettings(saved);
    setMiniBackendTunables({
      engineIdleTimeoutSeconds: saved.engineIdleTimeoutSeconds,
      workingResolutionMegapixels: saved.workingResolutionMegapixels,
      workingResolutionOcrClean: saved.workingResolutionOcrClean,
    });
    // Dev web has no desktop bridge: the override file is shell-side only.
    void desktopBridge.desktop
      ?.setMiniBackendThreadOverride(bridgePayloadFor(saved))
      .catch((error: unknown) => {
        console.debug('mini-backend thread override not delivered', error);
      });
  }, [settings, miniBackendTunables]);

  return useMemo(
    () => ({
      settings,
      setIntraOpThreads,
      hardwareConcurrency,
      miniBackendTunables,
      setMiniBackendTunables,
      handleSaveMiniBackendTunables,
    }),
    [
      settings,
      hardwareConcurrency,
      miniBackendTunables,
      handleSaveMiniBackendTunables,
    ],
  );
};
