import { useThemeStore } from '@koma/ui/stores/theme-store';
import { UpdateModalClassic } from './UpdateModalClassic';
import { UpdateModalNoir } from './noir/UpdateModalNoir';

export const UpdateModal = (props: React.ComponentProps<typeof UpdateModalClassic>) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <UpdateModalNoir {...props} /> : <UpdateModalClassic {...props} />;
};

export default UpdateModal;
