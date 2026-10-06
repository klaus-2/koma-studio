import { useThemeStore } from '@koma/ui/stores/theme-store';
import { DiskSpaceIndicatorClassic } from './DiskSpaceIndicatorClassic';
import { DiskSpaceIndicatorNoir } from './noir/DiskSpaceIndicatorNoir';

export type { DiskSpaceIndicatorProps } from './DiskSpaceIndicatorClassic';

export const DiskSpaceIndicator = (props: React.ComponentProps<typeof DiskSpaceIndicatorClassic>) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <DiskSpaceIndicatorNoir {...props} /> : <DiskSpaceIndicatorClassic {...props} />;
};

export default DiskSpaceIndicator;
