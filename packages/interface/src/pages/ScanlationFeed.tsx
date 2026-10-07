import { useThemeStore } from '@koma/ui/stores/theme-store';
import ScanlationFeedPageClassic from './ScanlationFeedClassic';
import { ScanlationFeedPage as ScanlationFeedPageNoir } from './scanlation-feed/noir/ScanlationFeedNoir';

export const ScanlationFeedPage = (props: React.ComponentProps<typeof ScanlationFeedPageClassic>) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <ScanlationFeedPageNoir {...props} /> : <ScanlationFeedPageClassic {...props} />;
};

export default ScanlationFeedPage;
