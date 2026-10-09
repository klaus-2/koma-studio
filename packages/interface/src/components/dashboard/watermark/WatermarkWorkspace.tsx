import { useThemeStore } from '@koma/ui/stores/theme-store';
import WatermarkWorkspaceClassic from './WatermarkWorkspaceClassic';
import WatermarkWorkspaceNoir from '../noir/WatermarkWorkspaceNoir';

const WatermarkWorkspace = (props: React.ComponentProps<typeof WatermarkWorkspaceClassic>) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <WatermarkWorkspaceNoir {...props} /> : <WatermarkWorkspaceClassic {...props} />;
};

export default WatermarkWorkspace;
