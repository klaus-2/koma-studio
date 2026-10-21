import ChapterOptimizerWorkspaceClassic from './ChapterOptimizerWorkspaceClassic';
import ChapterOptimizerWorkspaceNoir from './noir/ChapterOptimizerWorkspaceNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';

export type { ChapterOptimizerWorkspaceState } from './ChapterOptimizerWorkspace.types';

const ChapterOptimizerWorkspace = createFamilyComponent(ChapterOptimizerWorkspaceClassic, ChapterOptimizerWorkspaceNoir);

export default ChapterOptimizerWorkspace;
