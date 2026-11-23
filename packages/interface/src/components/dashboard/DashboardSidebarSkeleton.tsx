import DashboardSidebarSkeletonClassic from './DashboardSidebarSkeletonClassic';
import DashboardSidebarSkeletonNoir from './noir/DashboardSidebarSkeletonNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';
import { memo } from "react";

const DashboardSidebarSkeleton = createFamilyComponent(DashboardSidebarSkeletonClassic, DashboardSidebarSkeletonNoir);

export default memo(DashboardSidebarSkeleton);
