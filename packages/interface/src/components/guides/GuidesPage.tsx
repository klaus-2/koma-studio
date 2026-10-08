import { useThemeStore } from '@koma/ui/stores/theme-store';
import GuidesPageClassic from './GuidesPageClassic';
import GuidesPageV2 from '../koma/guides/GuidesPageV2';

export default function GuidesPage() {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <GuidesPageV2 /> : <GuidesPageClassic />;
}
