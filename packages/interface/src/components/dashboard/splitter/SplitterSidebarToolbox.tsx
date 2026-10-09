import { useThemeStore } from '@koma/ui/stores/theme-store';
import { SplitterSidebarToolboxClassic } from './SplitterSidebarToolboxClassic';
import { SplitterSidebarToolboxNoir } from '../noir/SplitterSidebarToolboxNoir';

export const SplitterSidebarToolbox = (props: React.ComponentProps<typeof SplitterSidebarToolboxClassic>) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <SplitterSidebarToolboxNoir {...props} /> : <SplitterSidebarToolboxClassic {...props} />;
};

export default SplitterSidebarToolbox;
