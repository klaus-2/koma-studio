import { useThemeStore } from '@koma/ui/stores/theme-store';
import EnhanceToolsPanelClassic from './EnhanceToolsPanelClassic';
import EnhanceToolsPanelNoir from './noir/EnhanceToolsPanelNoir';

const EnhanceToolsPanel = (props: React.ComponentProps<typeof EnhanceToolsPanelClassic>) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <EnhanceToolsPanelNoir {...props} /> : <EnhanceToolsPanelClassic {...props} />;
};

export default EnhanceToolsPanel;
