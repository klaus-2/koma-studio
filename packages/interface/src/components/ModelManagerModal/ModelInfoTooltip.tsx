import { ModelInfoTooltipClassic } from './ModelInfoTooltipClassic';
import { ModelInfoTooltipNoir } from './noir/ModelInfoTooltipNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';

export type { ModelInfoTooltipProps } from './ModelInfoTooltipClassic';

export const ModelInfoTooltip = createFamilyComponent(ModelInfoTooltipClassic, ModelInfoTooltipNoir);

export default ModelInfoTooltip;
