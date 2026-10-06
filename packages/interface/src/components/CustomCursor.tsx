import { useThemeStore } from '@koma/ui/stores/theme-store';
import { CustomCursorClassic } from './noir/CustomCursorClassic';
import { CustomCursorNoir } from './noir/CustomCursorNoir';

export const CustomCursor = () => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <CustomCursorNoir /> : <CustomCursorClassic />;
};
