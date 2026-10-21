import { SyncPanelClassic } from './SyncPanelClassic';
import { SyncPanelNoir } from './noir/SyncPanelNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';

export const SyncPanel = createFamilyComponent(SyncPanelClassic, SyncPanelNoir);

export default SyncPanel;
