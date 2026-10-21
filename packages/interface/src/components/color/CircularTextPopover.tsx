import { CircularTextPopoverClassic } from './CircularTextPopoverClassic';
import { CircularTextPopoverNoir } from './noir/CircularTextPopoverNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';

export const CircularTextPopover = createFamilyComponent(CircularTextPopoverClassic, CircularTextPopoverNoir);

export default CircularTextPopover;
