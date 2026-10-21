import { RuntimeProfileSectionClassic } from './RuntimeProfileSectionClassic';
import { RuntimeProfileSectionNoir } from './noir/RuntimeProfileSectionNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';

export const RuntimeProfileSection = createFamilyComponent(RuntimeProfileSectionClassic, RuntimeProfileSectionNoir);

export default RuntimeProfileSection;
