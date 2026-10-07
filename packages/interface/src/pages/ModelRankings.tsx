import { useThemeStore } from '@koma/ui/stores/theme-store';
import ModelRankingsPageClassic from './ModelRankingsClassic';
import { ModelRankingsPage as ModelRankingsPageNoir } from './noir/ModelRankingsNoir';

export const ModelRankingsPage = (props: React.ComponentProps<typeof ModelRankingsPageClassic>) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <ModelRankingsPageNoir {...props} /> : <ModelRankingsPageClassic {...props} />;
};

export default ModelRankingsPage;
