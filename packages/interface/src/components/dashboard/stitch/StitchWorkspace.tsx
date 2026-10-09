import { useThemeStore } from '@koma/ui/stores/theme-store';
import { StitchWorkspaceClassic } from './StitchWorkspaceClassic';
import { StitchWorkspaceNoir } from '../noir/StitchWorkspaceNoir';

export const StitchWorkspace = (props: React.ComponentProps<typeof StitchWorkspaceClassic>) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <StitchWorkspaceNoir {...props} /> : <StitchWorkspaceClassic {...props} />;
};

export default StitchWorkspace;
