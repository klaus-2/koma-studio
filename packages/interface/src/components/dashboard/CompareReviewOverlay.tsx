import type { ReactElement } from 'react';

import {
  CompareReviewOverlayClassic,
  type CompareReviewOverlayProps,
} from './CompareReviewOverlayClassic';
import CompareReviewOverlayNoir from './noir/CompareReviewOverlayNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';

const CompareReviewOverlayFamily = createFamilyComponent(
  CompareReviewOverlayClassic,
  CompareReviewOverlayNoir,
);

// Render-stage compare review: two synchronized zoom/pan viewers with a
// three-way view toggle. Mounted only while open (see DashboardOverlays).
export default function CompareReviewOverlay(
  props: CompareReviewOverlayProps,
): ReactElement {
  return <CompareReviewOverlayFamily {...props} />;
}
