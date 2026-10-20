import { useThemeStore } from '@koma/ui/stores/theme-store';
import DashboardRightSidebarClassic from './DashboardRightSidebarClassic';
import DashboardRightSidebarNoir from './noir/DashboardRightSidebarNoir';
import { memo } from 'react';

type DashboardRightSidebarProps = React.ComponentProps<typeof DashboardRightSidebarClassic>;

const DashboardRightSidebar = (props: DashboardRightSidebarProps) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <DashboardRightSidebarNoir {...props} /> : <DashboardRightSidebarClassic {...props} />;
};

export default memo(DashboardRightSidebar);
