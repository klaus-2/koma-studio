import { StitchSidebarToolboxClassic } from './StitchSidebarToolboxClassic';
import { StitchSidebarToolboxNoir } from '../noir/StitchSidebarToolboxNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';

export const StitchSidebarToolbox = createFamilyComponent(StitchSidebarToolboxClassic, StitchSidebarToolboxNoir);

export default StitchSidebarToolbox;
