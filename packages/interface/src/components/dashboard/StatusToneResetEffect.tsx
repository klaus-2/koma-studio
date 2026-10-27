/**
 * Status-tone reset — a null leaf so status messages do not re-render the
 * dashboard page just to clear the explicit tone flag.
 */
import { useEffect } from 'react';
import { useStatusStore } from '../../pages/dashboard/stores/status-store';

export function StatusToneResetEffect(): null {
  const statusMessage = useStatusStore((s) => s.statusMessage);
  useEffect(() => {
    const statusState = useStatusStore.getState();
    if (!statusState.statusToneExplicit) {
      statusState.setStatusMessageTone('info');
    }
    statusState.clearStatusToneExplicit();
  }, [statusMessage]);
  return null;
}
