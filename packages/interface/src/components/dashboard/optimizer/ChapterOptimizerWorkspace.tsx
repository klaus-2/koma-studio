import { useThemeStore } from '@koma/ui/stores/theme-store';
import ChapterOptimizerWorkspaceClassic from './ChapterOptimizerWorkspaceClassic';
import ChapterOptimizerWorkspaceNoir from './noir/ChapterOptimizerWorkspaceNoir';

export type { ChapterOptimizerWorkspaceState } from './ChapterOptimizerWorkspace.types';

const ChapterOptimizerWorkspace = (props: React.ComponentProps<typeof ChapterOptimizerWorkspaceClassic>) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <ChapterOptimizerWorkspaceNoir {...props} /> : <ChapterOptimizerWorkspaceClassic {...props} />;
};

export default ChapterOptimizerWorkspace;
