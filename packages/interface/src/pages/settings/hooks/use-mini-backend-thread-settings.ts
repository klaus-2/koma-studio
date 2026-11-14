import { useCallback, useMemo, useState } from 'react';

import { desktopBridge } from '@/lib/desktop-bridge';
import {
  loadMiniBackendThreadSettings,
  saveMiniBackendThreadSettings,
  type MiniBackendThreadSettings,
} from '../../../utils/miniBackendThreadSettings';

export const useMiniBackendThreadSettings = () => {
  const [settings, setSettings] = useState<MiniBackendThreadSettings>(() =>
    loadMiniBackendThreadSettings(),
  );
  const hardwareConcurrency =
    typeof navigator !== 'undefined' && navigator.hardwareConcurrency > 0
      ? navigator.hardwareConcurrency
      : null;

  const setIntraOpThreads = useCallback((value: number | null) => {
    const saved = saveMiniBackendThreadSettings({ intraOpThreads: value });
    setSettings(saved);
    // Dev web has no desktop bridge: the override file is shell-side only.
    void desktopBridge.desktop
      ?.setMiniBackendThreadOverride({
        intraOpThreads: saved.intraOpThreads,
      })
      .catch((error: unknown) => {
        console.debug('mini-backend thread override not delivered', error);
      });
  }, []);

  return useMemo(
    () => ({ settings, setIntraOpThreads, hardwareConcurrency }),
    [settings, hardwareConcurrency],
  );
};
