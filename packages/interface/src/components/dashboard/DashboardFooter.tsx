import DashboardFooterClassic from './DashboardFooterClassic';
import DashboardFooterNoir from './noir/DashboardFooterNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';
import { memo } from 'react';

const DashboardFooter = createFamilyComponent(DashboardFooterClassic, DashboardFooterNoir);

export default memo(DashboardFooter);
