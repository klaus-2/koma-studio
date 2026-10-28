import { useCallback, useMemo, useState } from 'react';

import type { useI18n } from '../../../i18n';
import type { UseUpdaterApi } from '../../../hooks/useUpdater';
import type { UpdaterChannel } from '../../../types';
import { statusCfg } from '../settings.constants';

type TranslationFn = ReturnType<typeof useI18n>['t'];

export interface UseSettingsUpdaterControlsArgs {
  updater: UseUpdaterApi;
  t: TranslationFn;
}

export const useSettingsUpdaterControls = ({
  updater,
  t,
}: UseSettingsUpdaterControlsArgs) => {
  const [busy, setBusy] = useState(false);

  const statusInfo = useMemo(() => statusCfg(updater.status), [updater.status]);
  const channelLabel =
    updater.channel === "beta"
      ? t("settings.updates.channelBeta")
      : t("settings.updates.channelStable");

  const handleCheck = useCallback(async () => {
    setBusy(true);
    try { await updater.checkForUpdates(); } finally { setBusy(false); }
  }, [updater]);

  const handleChannel = useCallback(async (ch: UpdaterChannel) => {
    setBusy(true);
    try { await updater.setChannel(ch); } finally { setBusy(false); }
  }, [updater]);

  return {
    busy,
    statusInfo,
    channelLabel,
    handleCheck,
    handleChannel,
  };
};
