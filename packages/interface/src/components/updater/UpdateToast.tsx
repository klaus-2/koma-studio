import { useThemeStore } from '@koma/ui/stores/theme-store';
import { UpdateToastClassic } from './UpdateToastClassic';
import { UpdateToastNoir } from './noir/UpdateToastNoir';

export const UpdateToast = () => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <UpdateToastNoir /> : <UpdateToastClassic />;
};

export default UpdateToast;
