import CleanerToolsPanelClassic from './CleanerToolsPanelClassic';
import CleanerToolsPanelNoir from './noir/CleanerToolsPanelNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';

const CleanerToolsPanel = createFamilyComponent(CleanerToolsPanelClassic, CleanerToolsPanelNoir);

export default CleanerToolsPanel;
