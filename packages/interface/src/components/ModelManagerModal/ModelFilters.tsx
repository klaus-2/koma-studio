import { ModelFiltersClassic } from './ModelFiltersClassic';
import { ModelFiltersNoir } from './noir/ModelFiltersNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';

export type { ModelFiltersProps } from './ModelFiltersClassic';

export const ModelFilters = createFamilyComponent(ModelFiltersClassic, ModelFiltersNoir);

export default ModelFilters;
