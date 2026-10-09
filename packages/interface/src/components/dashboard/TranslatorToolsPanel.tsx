import { useThemeStore } from '@koma/ui/stores/theme-store';
import TranslatorToolsPanelClassic from './TranslatorToolsPanelClassic';
import TranslatorToolsPanelNoir from './noir/TranslatorToolsPanelNoir';

const TranslatorToolsPanel = (props: React.ComponentProps<typeof TranslatorToolsPanelClassic>) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <TranslatorToolsPanelNoir {...props} /> : <TranslatorToolsPanelClassic {...props} />;
};

export default TranslatorToolsPanel;
