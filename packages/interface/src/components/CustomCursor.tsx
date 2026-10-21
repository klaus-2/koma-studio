import { CustomCursorClassic } from './noir/CustomCursorClassic';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';
import { CustomCursorNoir } from './noir/CustomCursorNoir';

export const CustomCursor = createFamilyComponent(CustomCursorClassic, CustomCursorNoir);
