import { SplitterWorkspaceClassic } from './SplitterWorkspaceClassic';
import { SplitterWorkspaceNoir } from '../noir/SplitterWorkspaceNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';

export const SplitterWorkspace = createFamilyComponent(SplitterWorkspaceClassic, SplitterWorkspaceNoir);

export default SplitterWorkspace;
