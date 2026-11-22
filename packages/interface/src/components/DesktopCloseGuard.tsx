import type { JSX } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { desktopBridge } from '@/lib/desktop-bridge';
import {
  setCloseGuardConsumer,
  type DesktopCloseGuardRequest,
} from '@/pages/dashboard/lib/desktop-close-guard';
import CloseGuardModal from './CloseGuardModal';

export function DesktopCloseGuard(): JSX.Element {
  const [request, setRequest] = useState<DesktopCloseGuardRequest | null>(null);

  useEffect(() => {
    setCloseGuardConsumer((next) => setRequest(next));
    return () => setCloseGuardConsumer(null);
  }, []);

  const closeAnyway = useCallback(() => {
    setRequest(null);
    const bridge = desktopBridge.desktop;
    bridge
      ?.windowState?.closeForce()
      .catch((error: unknown) => {
        bridge
          .sessionLog({
            level: 'warn',
            source: 'renderer',
            message: `close force failed: ${error instanceof Error ? error.message : String(error)}`,
          })
          .catch(() => undefined);
      });
  }, []);

  const cancel = useCallback(() => setRequest(null), []);

  return (
    <CloseGuardModal
      open={request !== null}
      onCloseAnyway={closeAnyway}
      onCancel={cancel}
    />
  );
}

export default DesktopCloseGuard;
