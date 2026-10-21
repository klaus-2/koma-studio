import SubModeToggleClassic from './SubModeToggleClassic';
import SubModeToggleNoir from './noir/SubModeToggleNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';
import { memo } from "react";

export type { SubModeToggleProps } from './SubModeToggleClassic';

export default memo(createFamilyComponent(SubModeToggleClassic, SubModeToggleNoir));
