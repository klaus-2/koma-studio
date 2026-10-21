import { useThemeStore } from '@koma/ui/stores/theme-store';
import { SplitterWorkspaceClassic } from './SplitterWorkspaceClassic';
import { SplitterWorkspaceNoir } from '../noir/SplitterWorkspaceNoir';

export const SplitterWorkspace = () => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <SplitterWorkspaceNoir /> : <SplitterWorkspaceClassic />;
};

export default SplitterWorkspace;
