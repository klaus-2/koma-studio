import DashboardEmptyStageClassic from './DashboardEmptyStageClassic';
import DashboardEmptyStageNoir from './noir/DashboardEmptyStageNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';
import { memo } from "react";

const DashboardEmptyStage = createFamilyComponent(DashboardEmptyStageClassic, DashboardEmptyStageNoir);

export default memo(DashboardEmptyStage);
