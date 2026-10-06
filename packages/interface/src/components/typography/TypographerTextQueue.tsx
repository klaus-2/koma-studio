import { useThemeStore } from '@koma/ui/stores/theme-store';
import { TypographerTextQueueClassic } from './TypographerTextQueueClassic';
import { TypographerTextQueueNoir } from './noir/TypographerTextQueueNoir';

export const TypographerTextQueue = (props: React.ComponentProps<typeof TypographerTextQueueClassic>) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <TypographerTextQueueNoir {...props} /> : <TypographerTextQueueClassic {...props} />;
};

export default TypographerTextQueue;
