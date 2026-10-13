import { memo } from 'react';

import { useI18n } from '../../i18n';
import { useUpdaterVersionInfo } from '../../hooks/useUpdater';

function VersionBadgeNoir() {
  const { t } = useI18n();
  const { currentVersion, channel } = useUpdaterVersionInfo();

  const channelColor: Record<string, string> = {
    stable: 'border-mint/50 text-mint bg-mint/10',
    beta: 'border-gold/50 text-gold bg-gold/10',
    alpha: 'border-crimson/50 text-crimson bg-crimson/10',
    nightly: 'border-azure/50 text-azure bg-azure/10',
  };

  if (!currentVersion) {
    return null;
  }

  return (
    <span
      title={t('versionBadge.tooltip', { version: currentVersion })}
      className={`inline-flex -rotate-2 select-none items-center border px-1 py-px font-mono text-[8px] font-bold uppercase tracking-[0.12em] ${channelColor[channel] ?? channelColor.stable} border`}
    >
      v{currentVersion}
    </span>
  );
}

export default memo(VersionBadgeNoir);
