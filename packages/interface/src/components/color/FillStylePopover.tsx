import { FillStylePopoverClassic } from './FillStylePopoverClassic';
import { FillStylePopoverNoir } from './noir/FillStylePopoverNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';

export const FillStylePopover = createFamilyComponent(FillStylePopoverClassic, FillStylePopoverNoir);

export default FillStylePopover;
