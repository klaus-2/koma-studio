import { useThemeStore } from '@koma/ui/stores/theme-store';
import { UpdateProgressClassic } from './UpdateProgressClassic';
import { UpdateProgressNoir } from './noir/UpdateProgressNoir';

export const UpdateProgress = (props: React.ComponentProps<typeof UpdateProgressClassic>) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <UpdateProgressNoir {...props} /> : <UpdateProgressClassic {...props} />;
};

export default UpdateProgress;
