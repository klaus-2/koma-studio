import { useThemeStore } from '@koma/ui/stores/theme-store';
import { CircularTextPopoverClassic } from './CircularTextPopoverClassic';
import { CircularTextPopoverNoir } from './noir/CircularTextPopoverNoir';

export const CircularTextPopover = (props: React.ComponentProps<typeof CircularTextPopoverClassic>) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <CircularTextPopoverNoir {...props} /> : <CircularTextPopoverClassic {...props} />;
};

export default CircularTextPopover;
