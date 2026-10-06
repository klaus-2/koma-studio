import { useThemeStore } from '@koma/ui/stores/theme-store';
import { ModelFiltersClassic } from './ModelFiltersClassic';
import { ModelFiltersNoir } from './noir/ModelFiltersNoir';

export type { ModelFiltersProps } from './ModelFiltersClassic';

export const ModelFilters = (props: React.ComponentProps<typeof ModelFiltersClassic>) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <ModelFiltersNoir {...props} /> : <ModelFiltersClassic {...props} />;
};

export default ModelFilters;
