import { useThemeStore } from '@koma/ui/stores/theme-store';
import { RenderEffectPopoverClassic } from './RenderEffectPopoverClassic';
import { RenderEffectPopoverNoir } from './noir/RenderEffectPopoverNoir';

export const RenderEffectPopover = (props: React.ComponentProps<typeof RenderEffectPopoverClassic>) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <RenderEffectPopoverNoir {...props} /> : <RenderEffectPopoverClassic {...props} />;
};

export default RenderEffectPopover;
