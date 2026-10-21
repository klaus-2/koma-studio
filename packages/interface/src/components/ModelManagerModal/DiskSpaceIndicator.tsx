import { DiskSpaceIndicatorClassic } from './DiskSpaceIndicatorClassic';
import { DiskSpaceIndicatorNoir } from './noir/DiskSpaceIndicatorNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';

export type { DiskSpaceIndicatorProps } from './DiskSpaceIndicatorClassic';

export const DiskSpaceIndicator = createFamilyComponent(DiskSpaceIndicatorClassic, DiskSpaceIndicatorNoir);

export default DiskSpaceIndicator;
