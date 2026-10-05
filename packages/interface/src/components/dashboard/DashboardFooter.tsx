import { useThemeStore } from '@koma/ui/stores/theme-store';
import DashboardFooterClassic from './DashboardFooterClassic';
import DashboardFooterNoir from './noir/DashboardFooterNoir';

type DashboardFooterProps = React.ComponentProps<typeof DashboardFooterClassic>;

const DashboardFooter = (props: DashboardFooterProps) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <DashboardFooterNoir {...props} /> : <DashboardFooterClassic {...props} />;
};

export default DashboardFooter;
