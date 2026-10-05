import { useThemeStore } from '@koma/ui/stores/theme-store';
import {
  useIntersectionVirtualization as useIntersectionVirtualizationClassic,
  VirtualizedLongStrip as VirtualizedLongStripClassic,
  type VirtualizedLongStripProps,
} from './VirtualizedLongStripClassic';
import {
  VirtualizedLongStripNoir,
} from './noir/VirtualizedLongStripNoir';

export type { VirtualizedLongStripProps };

export function useIntersectionVirtualization(config: Parameters<typeof useIntersectionVirtualizationClassic>[0]) {
  return useIntersectionVirtualizationClassic(config);
}

export function VirtualizedLongStrip(props: VirtualizedLongStripProps) {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <VirtualizedLongStripNoir {...props} /> : <VirtualizedLongStripClassic {...props} />;
}
