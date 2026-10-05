import { useThemeStore } from '@koma/ui/stores/theme-store';
import DashboardEmptyStageClassic from './DashboardEmptyStageClassic';
import DashboardEmptyStageNoir from './noir/DashboardEmptyStageNoir';

interface DashboardEmptyStageProps {
  emptyPreviewTipIndex: number;
  currentEmptyPreviewTip: string;
}

const DashboardEmptyStage = (props: DashboardEmptyStageProps) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <DashboardEmptyStageNoir {...props} /> : <DashboardEmptyStageClassic {...props} />;
};

export default DashboardEmptyStage;
