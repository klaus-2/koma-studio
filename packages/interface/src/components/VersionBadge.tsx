import { memo } from 'react';

import { useI18n } from '../i18n';
import { useUpdaterVersionInfo } from '../hooks/useUpdater';

function VersionBadge() {
  const { t } = useI18n();
  const { currentVersion, channel } = useUpdaterVersionInfo();

  return (
    <span
      className={`koma-version-badge koma-version-badge--${channel}`}
      title={t('versionBadge.tooltip', { version: currentVersion })}
    >
      v{currentVersion}
    </span>
  );
}

export default memo(VersionBadge);
