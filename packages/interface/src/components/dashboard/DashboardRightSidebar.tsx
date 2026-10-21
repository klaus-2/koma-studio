import DashboardRightSidebarClassic from './DashboardRightSidebarClassic';
import DashboardRightSidebarNoir from './noir/DashboardRightSidebarNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';
import { memo } from "react";

const DashboardRightSidebar = createFamilyComponent(DashboardRightSidebarClassic, DashboardRightSidebarNoir);

export default memo(DashboardRightSidebar);
