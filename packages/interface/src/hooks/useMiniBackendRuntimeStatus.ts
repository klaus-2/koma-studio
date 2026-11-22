import { useEffect, useState } from 'react';

import { desktopBridge } from '../lib/desktop-bridge';
import type { DesktopMiniBackendRuntimeState } from '../types';

/**
 * Live mini-backend runtime state from the desktop bridge (push events plus
 * one initial read). Returns null outside the desktop runtime, where no
 * sidecar lifecycle exists and nothing should be gated on it.
 */
export function useMiniBackendRuntimeStatus(): DesktopMiniBackendRuntimeState | null {
  const [state, setState] = useState<DesktopMiniBackendRuntimeState | null>(null);

  useEffect(() => {
    const desktop = desktopBridge.desktop;
    if (!desktop?.getMiniBackendRuntimeState) {
      return;
    }

    let disposed = false;
    let eventVersion = 0;

    const listener = (next: DesktopMiniBackendRuntimeState): void => {
      eventVersion += 1;
      if (!disposed) {
        setState(next);
      }
    };

    try {
      desktop.onMiniBackendRuntimeState(listener);
    } catch {
      return;
    }

    const requestedAtVersion = eventVersion;
    void desktop
      .getMiniBackendRuntimeState()
      .then((initial) => {
        if (!disposed && eventVersion === requestedAtVersion) {
          setState(initial ?? null);
        }
      })
      .catch(() => {
        if (!disposed && eventVersion === requestedAtVersion) {
          setState(null);
        }
      });

    return () => {
      disposed = true;
      try {
        desktop.offMiniBackendRuntimeState?.(listener);
      } catch {
        // Listener already torn down with the webview bridge.
      }
    };
  }, []);

  return state;
}
