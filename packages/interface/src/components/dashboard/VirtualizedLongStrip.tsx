import { VirtualizedLongStrip as VirtualizedLongStripClassic } from './VirtualizedLongStripClassic';
import type { VirtualizedLongStripProps } from './VirtualizedLongStripClassic';
import {
  VirtualizedLongStripNoir,
} from './noir/VirtualizedLongStripNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';

export type { VirtualizedLongStripProps };

export const VirtualizedLongStrip = createFamilyComponent(VirtualizedLongStripClassic, VirtualizedLongStripNoir);
