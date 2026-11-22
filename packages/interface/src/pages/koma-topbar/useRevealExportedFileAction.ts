import { useCallback } from 'react';

import { useI18n } from '../../i18n';
import { desktopBridge } from '../../lib/desktop-bridge';
import { revealExportedFile } from '../dashboard/lib/reveal-exported-file';
import { useExportStore } from '../dashboard/stores/export-store';
import { useStatusStore } from '../dashboard/stores/status-store';

export interface RevealExportedFileAction {
  readonly filePath: string | null;
  readonly reveal: () => void;
}

export const useRevealExportedFileAction = (): RevealExportedFileAction => {
  const { t } = useI18n();
  const lastExportedFilePath = useExportStore((s) => s.lastExportedFilePath);
  const setTonedStatus = useStatusStore((s) => s.setTonedStatus);

  const filePath =
    desktopBridge.desktop?.system !== undefined ? lastExportedFilePath : null;

  const reveal = useCallback((): void => {
    if (!lastExportedFilePath) {
      return;
    }
    void revealExportedFile(lastExportedFilePath).then((opened) => {
      if (!opened) {
        setTonedStatus(t('dashboard.topbar.revealExportedFailed'), 'warning');
      }
    });
  }, [lastExportedFilePath, setTonedStatus, t]);

  return { filePath, reveal };
};
