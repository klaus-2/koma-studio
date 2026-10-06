import { useThemeStore } from '@koma/ui/stores/theme-store';
import { ModelInfoTooltipClassic } from './ModelInfoTooltipClassic';
import { ModelInfoTooltipNoir } from './noir/ModelInfoTooltipNoir';

export type { ModelInfoTooltipProps } from './ModelInfoTooltipClassic';

export const ModelInfoTooltip = (props: React.ComponentProps<typeof ModelInfoTooltipClassic>) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <ModelInfoTooltipNoir {...props} /> : <ModelInfoTooltipClassic {...props} />;
};

export default ModelInfoTooltip;
