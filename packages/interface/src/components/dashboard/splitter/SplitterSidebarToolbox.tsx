import { SplitterSidebarToolboxClassic } from './SplitterSidebarToolboxClassic';
import { SplitterSidebarToolboxNoir } from '../noir/SplitterSidebarToolboxNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';

export const SplitterSidebarToolbox = createFamilyComponent(SplitterSidebarToolboxClassic, SplitterSidebarToolboxNoir);

export default SplitterSidebarToolbox;
