import { RuntimeStartupToastClassic } from './RuntimeStartupToastClassic';
import { RuntimeStartupToastNoir } from './noir/RuntimeStartupToastNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';

export const RuntimeStartupToast = createFamilyComponent(RuntimeStartupToastClassic, RuntimeStartupToastNoir);

export default RuntimeStartupToast;
