import { useThemeStore } from '@koma/ui/stores/theme-store';
import { FillStylePopoverClassic } from './FillStylePopoverClassic';
import { FillStylePopoverNoir } from './noir/FillStylePopoverNoir';

export const FillStylePopover = (props: React.ComponentProps<typeof FillStylePopoverClassic>) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <FillStylePopoverNoir {...props} /> : <FillStylePopoverClassic {...props} />;
};

export default FillStylePopover;

