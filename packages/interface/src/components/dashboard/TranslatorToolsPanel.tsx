import TranslatorToolsPanelClassic from './TranslatorToolsPanelClassic';
import TranslatorToolsPanelNoir from './noir/TranslatorToolsPanelNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';

const TranslatorToolsPanel = createFamilyComponent(TranslatorToolsPanelClassic, TranslatorToolsPanelNoir);

export default TranslatorToolsPanel;
