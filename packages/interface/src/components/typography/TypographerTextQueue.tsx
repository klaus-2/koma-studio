import { TypographerTextQueueClassic } from './TypographerTextQueueClassic';
import { TypographerTextQueueNoir } from './noir/TypographerTextQueueNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';

export const TypographerTextQueue = createFamilyComponent(TypographerTextQueueClassic, TypographerTextQueueNoir);

export default TypographerTextQueue;
