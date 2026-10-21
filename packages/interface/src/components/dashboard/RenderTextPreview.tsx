import RenderTextPreviewClassic from './RenderTextPreviewClassic';
import RenderTextPreviewNoir from './noir/RenderTextPreviewNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';

const RenderTextPreview = createFamilyComponent(RenderTextPreviewClassic, RenderTextPreviewNoir);

export default RenderTextPreview;