import { useThemeStore } from '@koma/ui/stores/theme-store';
import { SyncPanelClassic } from './SyncPanelClassic';
import { SyncPanelNoir } from './noir/SyncPanelNoir';

export const SyncPanel = () => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <SyncPanelNoir /> : <SyncPanelClassic />;
};

export default SyncPanel;
