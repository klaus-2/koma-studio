import { useThemeStore } from '@koma/ui/stores/theme-store';
import { HexColorPopoverClassic } from './HexColorPopoverClassic';
import { HexColorPopoverNoir } from './noir/HexColorPopoverNoir';

export const HexColorPopover = (props: React.ComponentProps<typeof HexColorPopoverClassic>) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <HexColorPopoverNoir {...props} /> : <HexColorPopoverClassic {...props} />;
};

export default HexColorPopover;
