import { useThemeStore } from '@koma/ui/stores/theme-store';
import DashboardLeftSidebarClassic, {
  type AioImageHistoryMeta,
} from './DashboardLeftSidebarClassic';
import DashboardLeftSidebarNoir from './noir/DashboardLeftSidebarNoir';
import { memo } from 'react';

export type { AioImageHistoryMeta };

type DashboardLeftSidebarProps = React.ComponentProps<typeof DashboardLeftSidebarClassic>;

const DashboardLeftSidebar = (props: DashboardLeftSidebarProps) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <DashboardLeftSidebarNoir {...props} /> : <DashboardLeftSidebarClassic {...props} />;
};

export default memo(DashboardLeftSidebar);
