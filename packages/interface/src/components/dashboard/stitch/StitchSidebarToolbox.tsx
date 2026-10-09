import { useThemeStore } from '@koma/ui/stores/theme-store';
import { StitchSidebarToolboxClassic } from './StitchSidebarToolboxClassic';
import { StitchSidebarToolboxNoir } from '../noir/StitchSidebarToolboxNoir';

export const StitchSidebarToolbox = (props: React.ComponentProps<typeof StitchSidebarToolboxClassic>) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <StitchSidebarToolboxNoir {...props} /> : <StitchSidebarToolboxClassic {...props} />;
};

export default StitchSidebarToolbox;
