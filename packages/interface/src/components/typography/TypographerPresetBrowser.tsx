import { useThemeStore } from '@koma/ui/stores/theme-store';
import { TypographerPresetBrowserClassic } from './TypographerPresetBrowserClassic';
import { TypographerPresetBrowserNoir } from './noir/TypographerPresetBrowserNoir';

export const TypographerPresetBrowser = (props: React.ComponentProps<typeof TypographerPresetBrowserClassic>) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <TypographerPresetBrowserNoir {...props} /> : <TypographerPresetBrowserClassic {...props} />;
};

export default TypographerPresetBrowser;
