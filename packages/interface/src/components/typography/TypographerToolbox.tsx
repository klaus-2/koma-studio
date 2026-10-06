import { useThemeStore } from '@koma/ui/stores/theme-store';
import { TypographerToolboxClassic } from './TypographerToolboxClassic';
import { TypographerToolboxNoir } from './noir/TypographerToolboxNoir';

export const TypographerToolbox = (props: React.ComponentProps<typeof TypographerToolboxClassic>) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <TypographerToolboxNoir {...props} /> : <TypographerToolboxClassic {...props} />;
};

export default TypographerToolbox;
