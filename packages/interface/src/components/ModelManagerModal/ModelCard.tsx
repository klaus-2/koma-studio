import { useThemeStore } from '@koma/ui/stores/theme-store';
import { ModelCardClassic } from './ModelCardClassic';
import { ModelCardNoir } from './noir/ModelCardNoir';

export type { ModelCardProps } from './ModelCardClassic';

export const ModelCard = (props: React.ComponentProps<typeof ModelCardClassic>) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <ModelCardNoir {...props} /> : <ModelCardClassic {...props} />;
};

export default ModelCard;
