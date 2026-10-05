import { memo } from 'react';

import { useI18n } from '../../i18n';
import { useUpdaterVersionInfo } from '../../hooks/useUpdater';

function VersionBadgeNoir() {
  const { t } = useI18n();
  const { currentVersion, channel } = useUpdaterVersionInfo();

  const channelColor: Record<string, string> = {
    stable: 'border-mint/40 text-mint',
    beta: 'border-gold/40 text-gold',
    alpha: 'border-crimson/40 text-crimson',
    nightly: 'border-azure/40 text-azure',
  };

  return (
    <span
      title={t('versionBadge.tooltip', { version: currentVersion })}
      className={`panel-cut-sm inline-flex items-center bg-ink px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest ${channelColor[channel] ?? channelColor.stable} border`}
    >
      v{currentVersion}
    </span>
  );
}

export default memo(VersionBadgeNoir);
