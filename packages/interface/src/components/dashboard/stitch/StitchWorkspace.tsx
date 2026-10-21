import { StitchWorkspaceClassic } from './StitchWorkspaceClassic';
import { StitchWorkspaceNoir } from '../noir/StitchWorkspaceNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';

export const StitchWorkspace = createFamilyComponent(StitchWorkspaceClassic, StitchWorkspaceNoir);

export default StitchWorkspace;
