import { useThemeStore } from '@koma/ui/stores/theme-store';
import { TextEffectPopoverClassic } from './TextEffectPopoverClassic';
import { TextEffectPopoverNoir } from './noir/TextEffectPopoverNoir';

export const TextEffectPopover = (props: React.ComponentProps<typeof TextEffectPopoverClassic>) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <TextEffectPopoverNoir {...props} /> : <TextEffectPopoverClassic {...props} />;
};

export default TextEffectPopover;
