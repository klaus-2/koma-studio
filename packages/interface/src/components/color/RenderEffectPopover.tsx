import { RenderEffectPopoverClassic } from './RenderEffectPopoverClassic';
import { RenderEffectPopoverNoir } from './noir/RenderEffectPopoverNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';

export const RenderEffectPopover = createFamilyComponent(RenderEffectPopoverClassic, RenderEffectPopoverNoir);

export default RenderEffectPopover;
