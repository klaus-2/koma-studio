import { ModelProgressBarClassic } from './ModelProgressBarClassic';
import { ModelProgressBarNoir } from './noir/ModelProgressBarNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';

export type { ModelProgressBarProps } from './ModelProgressBarClassic';

export const ModelProgressBar = createFamilyComponent(ModelProgressBarClassic, ModelProgressBarNoir);

export default ModelProgressBar;
