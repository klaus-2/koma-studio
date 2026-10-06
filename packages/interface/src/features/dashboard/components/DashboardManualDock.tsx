import { useThemeStore } from '@koma/ui/stores/theme-store';
import { DashboardManualDockClassic } from './DashboardManualDockClassic';
import { DashboardManualDockNoir } from './noir/DashboardManualDockNoir';

export type { DashboardManualDockProps } from './DashboardManualDockClassic';

function DashboardManualDock(props: React.ComponentProps<typeof DashboardManualDockClassic>) {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <DashboardManualDockNoir {...props} /> : <DashboardManualDockClassic {...props} />;
}

export { DashboardManualDock };
export default DashboardManualDock;