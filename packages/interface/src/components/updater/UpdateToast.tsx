import { UpdateToastClassic } from './UpdateToastClassic';
import { UpdateToastNoir } from './noir/UpdateToastNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';

export const UpdateToast = createFamilyComponent(UpdateToastClassic, UpdateToastNoir);

export default UpdateToast;
