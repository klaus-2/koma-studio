import { memo } from 'react';
import { ModelFiltersClassic } from './ModelFiltersClassic';
import { ModelFiltersNoir } from './noir/ModelFiltersNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';

export type { ModelFiltersProps } from './ModelFiltersClassic';

export const ModelFilters = memo(
  createFamilyComponent(memo(ModelFiltersClassic), memo(ModelFiltersNoir)),
);

export default ModelFilters;
