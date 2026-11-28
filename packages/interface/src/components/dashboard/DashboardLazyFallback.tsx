import type React from 'react';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';
import { DashboardLazyFallbackClassic } from './DashboardLazyFallbackClassic';
import {
  DashboardLazyFallbackNoir,
  type DashboardLazyFallbackProps,
} from './noir/DashboardLazyFallbackNoir';

const FamilyDashboardLazyFallback = createFamilyComponent<DashboardLazyFallbackProps>(
  DashboardLazyFallbackClassic,
  DashboardLazyFallbackNoir,
);

export function DashboardLazyFallback(props: DashboardLazyFallbackProps): React.ReactElement {
  return <FamilyDashboardLazyFallback {...props} />;
}

export default DashboardLazyFallback;
