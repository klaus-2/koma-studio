import React, { memo } from 'react';
import DashboardFooterClassic from './DashboardFooterClassic';
import DashboardFooterNoir from './noir/DashboardFooterNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';
import { useCacheLimitEnforcement } from '@/pages/dashboard/hooks/use-cache-limit-enforcement';
import { useEconomicUiMode } from '@/pages/dashboard/hooks/use-economic-ui-mode';

const FamilyFooter = createFamilyComponent(DashboardFooterClassic, DashboardFooterNoir);

type FooterProps = React.ComponentProps<typeof FamilyFooter>;

const DashboardFooter = (props: FooterProps): React.JSX.Element => {
  useEconomicUiMode();
  useCacheLimitEnforcement();
  return <FamilyFooter {...props} />;
};

export default memo(DashboardFooter);
