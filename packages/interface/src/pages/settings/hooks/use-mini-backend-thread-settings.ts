import { useCallback, useMemo, useState } from 'react';
import type { SetStateAction } from 'react';

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

export type MiniBackendTunablesSaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

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
  const [miniBackendTunables, setMiniBackendTunablesState] =
    useState<MiniBackendTunablesSettings>(() => ({
      engineIdleTimeoutSeconds: settings.engineIdleTimeoutSeconds,
      workingResolutionMegapixels: settings.workingResolutionMegapixels,
      workingResolutionOcrClean: settings.workingResolutionOcrClean,
    }));
  const [tunablesSaveStatus, setTunablesSaveStatus] =
    useState<MiniBackendTunablesSaveStatus>('idle');

  const setMiniBackendTunables = useCallback(
    (next: SetStateAction<MiniBackendTunablesSettings>) => {
      setTunablesSaveStatus('idle');
      setMiniBackendTunablesState(next);
    },
    [],
  );
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
    setMiniBackendTunablesState({
      engineIdleTimeoutSeconds: saved.engineIdleTimeoutSeconds,
      workingResolutionMegapixels: saved.workingResolutionMegapixels,
      workingResolutionOcrClean: saved.workingResolutionOcrClean,
    });
    const bridge = desktopBridge.desktop;
    if (!bridge) {
      // Dev web has no desktop bridge: the override file is shell-side only.
      setTunablesSaveStatus('saved');
      return;
    }
    setTunablesSaveStatus('saving');
    void bridge
      .setMiniBackendThreadOverride(bridgePayloadFor(saved))
      .then(() => {
        setTunablesSaveStatus('saved');
      })
      .catch((error: unknown) => {
        console.error('mini-backend thread override not delivered', error);
        setTunablesSaveStatus('failed');
      });
  }, [settings, miniBackendTunables]);

  return useMemo(
    () => ({
      settings,
      setIntraOpThreads,
      hardwareConcurrency,
      miniBackendTunables,
      setMiniBackendTunables,
      tunablesSaveStatus,
      handleSaveMiniBackendTunables,
    }),
    [
      settings,
      setIntraOpThreads,
      hardwareConcurrency,
      miniBackendTunables,
      setMiniBackendTunables,
      tunablesSaveStatus,
      handleSaveMiniBackendTunables,
    ],
  );
};
