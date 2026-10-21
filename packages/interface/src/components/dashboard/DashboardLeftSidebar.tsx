import DashboardLeftSidebarClassic, {
  type AioImageHistoryMeta,
} from './DashboardLeftSidebarClassic';
import DashboardLeftSidebarNoir from './noir/DashboardLeftSidebarNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';
import { memo } from 'react';

export type { AioImageHistoryMeta };

const DashboardLeftSidebar = createFamilyComponent(DashboardLeftSidebarClassic, DashboardLeftSidebarNoir);

export default memo(DashboardLeftSidebar);
