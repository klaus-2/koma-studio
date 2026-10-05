import { memo } from 'react';
import { useThemeStore } from '@koma/ui/stores/theme-store';
import VersionBadgeClassic from './VersionBadgeClassic';
import VersionBadgeNoir from './noir/VersionBadgeNoir';

function VersionBadge() {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <VersionBadgeNoir /> : <VersionBadgeClassic />;
}

export default memo(VersionBadge);
