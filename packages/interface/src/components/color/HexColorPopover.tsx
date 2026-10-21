import { HexColorPopoverClassic } from './HexColorPopoverClassic';
import { HexColorPopoverNoir } from './noir/HexColorPopoverNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';

export const HexColorPopover = createFamilyComponent(HexColorPopoverClassic, HexColorPopoverNoir);

export default HexColorPopover;
