import { useThemeStore } from '@koma/ui/stores/theme-store';
import KlSliderClassic from './KlSliderClassic';
import KlSliderNoir from './noir/KlSliderNoir';
import { memo } from 'react';

export type { KlSliderProps } from './KlSliderClassic';

export default memo(function KlSlider(props: React.ComponentProps<typeof KlSliderClassic>) {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <KlSliderNoir {...props} /> : <KlSliderClassic {...props} />;
});
