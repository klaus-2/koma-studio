import { useThemeStore } from '@koma/ui/stores/theme-store';
import KlSliderClassic from './KlSliderClassic';
import KlSliderNoir from './noir/KlSliderNoir';

export type { KlSliderProps } from './KlSliderClassic';

export default function KlSlider(props: React.ComponentProps<typeof KlSliderClassic>) {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <KlSliderNoir {...props} /> : <KlSliderClassic {...props} />;
}
