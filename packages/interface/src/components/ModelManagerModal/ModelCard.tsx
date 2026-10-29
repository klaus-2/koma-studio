import { memo } from 'react';
import { ModelCardClassic } from './ModelCardClassic';
import { ModelCardNoir } from './noir/ModelCardNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';

export type { ModelCardProps } from './ModelCardClassic';

// Memoized at both levels: the dispatcher skips entirely on equal props, and
// each family card skips when only OTHER models' entries were patched.
export const ModelCard = memo(
  createFamilyComponent(memo(ModelCardClassic), memo(ModelCardNoir)),
);

export default ModelCard;
