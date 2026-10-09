import { useThemeStore } from '@koma/ui/stores/theme-store';
import CleanerToolsPanelClassic from './CleanerToolsPanelClassic';
import CleanerToolsPanelNoir from './noir/CleanerToolsPanelNoir';

const CleanerToolsPanel = (props: React.ComponentProps<typeof CleanerToolsPanelClassic>) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <CleanerToolsPanelNoir {...props} /> : <CleanerToolsPanelClassic {...props} />;
};

export default CleanerToolsPanel;
