import WatermarkWorkspaceClassic from './WatermarkWorkspaceClassic';
import WatermarkWorkspaceNoir from '../noir/WatermarkWorkspaceNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';

const WatermarkWorkspace = createFamilyComponent(WatermarkWorkspaceClassic, WatermarkWorkspaceNoir);

export default WatermarkWorkspace;
