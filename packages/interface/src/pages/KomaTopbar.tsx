import { memo } from 'react';
import { useThemeStore } from '@koma/ui/stores/theme-store';
import KomaTopbarClassic from './KomaTopbarClassic';
import KomaTopbarNoir from './KomaTopbarNoir';

const KomaTopbar = memo(function KomaTopbar(props: React.ComponentProps<typeof KomaTopbarClassic>) {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <KomaTopbarNoir {...props} /> : <KomaTopbarClassic {...props} />;
});

export default KomaTopbar;