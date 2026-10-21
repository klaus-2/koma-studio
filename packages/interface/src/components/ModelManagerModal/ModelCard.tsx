import { ModelCardClassic } from './ModelCardClassic';
import { ModelCardNoir } from './noir/ModelCardNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';

export type { ModelCardProps } from './ModelCardClassic';

export const ModelCard = createFamilyComponent(ModelCardClassic, ModelCardNoir);

export default ModelCard;
