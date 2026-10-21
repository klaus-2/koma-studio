import EnhanceToolsPanelClassic from './EnhanceToolsPanelClassic';
import EnhanceToolsPanelNoir from './noir/EnhanceToolsPanelNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';

const EnhanceToolsPanel = createFamilyComponent(EnhanceToolsPanelClassic, EnhanceToolsPanelNoir);

export default EnhanceToolsPanel;
