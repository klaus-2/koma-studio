import { useThemeStore } from '@koma/ui/stores/theme-store';
import { SplitterWorkspaceClassic } from './SplitterWorkspaceClassic';
import { SplitterWorkspaceNoir } from '../noir/SplitterWorkspaceNoir';

export const SplitterWorkspace = (props: React.ComponentProps<typeof SplitterWorkspaceClassic>) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <SplitterWorkspaceNoir {...props} /> : <SplitterWorkspaceClassic {...props} />;
};

export default SplitterWorkspace;
