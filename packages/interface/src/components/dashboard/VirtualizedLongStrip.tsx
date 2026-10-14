import { useThemeStore } from '@koma/ui/stores/theme-store';
import { VirtualizedLongStrip as VirtualizedLongStripClassic } from './VirtualizedLongStripClassic';
import type { VirtualizedLongStripProps } from './VirtualizedLongStripClassic';
import {
  VirtualizedLongStripNoir,
} from './noir/VirtualizedLongStripNoir';

export type { VirtualizedLongStripProps };

export function VirtualizedLongStrip(props: VirtualizedLongStripProps) {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <VirtualizedLongStripNoir {...props} /> : <VirtualizedLongStripClassic {...props} />;
}
