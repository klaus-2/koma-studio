import { memo } from 'react';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';
import { DashboardManualDockClassic } from './DashboardManualDockClassic';
import { DashboardManualDockNoir } from './noir/DashboardManualDockNoir';

export type { DashboardManualDockProps } from './DashboardManualDockClassic';

const DashboardManualDock = createFamilyComponent(
  memo(DashboardManualDockClassic),
  memo(DashboardManualDockNoir),
);

export { DashboardManualDock };
export default DashboardManualDock;