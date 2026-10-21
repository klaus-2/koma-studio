import { TextEffectPopoverClassic } from './TextEffectPopoverClassic';
import { TextEffectPopoverNoir } from './noir/TextEffectPopoverNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';

export const TextEffectPopover = createFamilyComponent(TextEffectPopoverClassic, TextEffectPopoverNoir);

export default TextEffectPopover;
