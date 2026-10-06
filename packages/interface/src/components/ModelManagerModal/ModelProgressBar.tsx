import { useThemeStore } from '@koma/ui/stores/theme-store';
import { ModelProgressBarClassic } from './ModelProgressBarClassic';
import { ModelProgressBarNoir } from './noir/ModelProgressBarNoir';

export type { ModelProgressBarProps } from './ModelProgressBarClassic';

export const ModelProgressBar = (props: React.ComponentProps<typeof ModelProgressBarClassic>) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <ModelProgressBarNoir {...props} /> : <ModelProgressBarClassic {...props} />;
};

export default ModelProgressBar;
