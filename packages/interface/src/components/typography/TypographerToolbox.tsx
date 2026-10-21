import { TypographerToolboxClassic } from './TypographerToolboxClassic';
import { TypographerToolboxNoir } from './noir/TypographerToolboxNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';

export const TypographerToolbox = createFamilyComponent(TypographerToolboxClassic, TypographerToolboxNoir);

export default TypographerToolbox;
