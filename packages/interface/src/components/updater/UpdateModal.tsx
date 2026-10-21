import { UpdateModalClassic } from './UpdateModalClassic';
import { UpdateModalNoir } from './noir/UpdateModalNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';

export const UpdateModal = createFamilyComponent(UpdateModalClassic, UpdateModalNoir);

export default UpdateModal;
