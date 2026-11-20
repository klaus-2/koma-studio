import { useCallback, useMemo, useRef, useState } from 'react';
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
  // Fields this instance actually edited (the calibration surfaces mount a
  // second instance on the same tab as the thread controls). The save spreads
  // ONLY these over the freshly loaded record, so a second instance's newer
  // values for untouched fields are never silently reverted.
  const touchedTunablesKeysRef = useRef<
    ReadonlySet<keyof MiniBackendTunablesSettings>
  >(new Set());

  const setMiniBackendTunables = useCallback(
    (next: SetStateAction<MiniBackendTunablesSettings>) => {
      setTunablesSaveStatus('idle');
      setMiniBackendTunablesState((prev) => {
        const resolved =
          typeof next === 'function' ? next(prev) : (next as MiniBackendTunablesSettings);
        touchedTunablesKeysRef.current = new Set([
          ...touchedTunablesKeysRef.current,
          ...(Object.keys(resolved) as (keyof MiniBackendTunablesSettings)[]).filter(
            (key) => resolved[key] !== prev[key],
          ),
        ]);
        return resolved;
      });
    },
    [],
  );
  const hardwareConcurrency =
    typeof navigator !== 'undefined' && navigator.hardwareConcurrency > 0
      ? navigator.hardwareConcurrency
      : null;

  const setIntraOpThreads = useCallback(
    (value: number | null) => {
      // Re-read the persisted record: other live hook instances (calibration
      // apply) may have written newer values after this instance mounted.
      const saved = saveMiniBackendThreadSettings({
        ...loadMiniBackendThreadSettings(),
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
    [],
  );

  const handleSaveMiniBackendTunables = useCallback(() => {
    // Re-read the persisted record at save time and spread only the fields
    // this instance edited: this hook is state-per-instance, and the
    // calibration surfaces mount a second instance on the same tab as the
    // thread controls — spreading the whole mount draft would silently
    // revert values the other instance (or the user) wrote meanwhile.
    const fresh = loadMiniBackendThreadSettings();
    const draft = miniBackendTunables;
    const next: MiniBackendThreadSettings = { ...fresh };
    for (const key of touchedTunablesKeysRef.current) {
      // Union-key writes need per-key narrowing (TS intersection rule).
      if (key === 'engineIdleTimeoutSeconds') {
        next.engineIdleTimeoutSeconds = draft.engineIdleTimeoutSeconds;
      } else if (key === 'workingResolutionMegapixels') {
        next.workingResolutionMegapixels = draft.workingResolutionMegapixels;
      } else if (key === 'workingResolutionOcrClean') {
        next.workingResolutionOcrClean = draft.workingResolutionOcrClean;
      }
    }
    const saved = saveMiniBackendThreadSettings(next);
    touchedTunablesKeysRef.current = new Set();
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
  }, [miniBackendTunables]);

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
