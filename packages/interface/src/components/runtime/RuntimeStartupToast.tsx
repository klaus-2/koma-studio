import { useThemeStore } from '@koma/ui/stores/theme-store';
import { RuntimeStartupToastClassic } from './RuntimeStartupToastClassic';
import { RuntimeStartupToastNoir } from './noir/RuntimeStartupToastNoir';

export const RuntimeStartupToast = () => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <RuntimeStartupToastNoir /> : <RuntimeStartupToastClassic />;
};

export default RuntimeStartupToast;
