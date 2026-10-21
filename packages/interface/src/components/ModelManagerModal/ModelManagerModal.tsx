import ModelManagerModalClassic from './ModelManagerModalClassic';
import ModelManagerModalNoir from './noir/ModelManagerModalNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';

export type { ModelManagerModalProps } from './ModelManagerModalClassic';

const ModelManagerModal = createFamilyComponent(ModelManagerModalClassic, ModelManagerModalNoir);

export { ModelManagerModal };
export default ModelManagerModal;
