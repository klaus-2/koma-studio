import { useThemeStore } from '@koma/ui/stores/theme-store';
import ResourcesPageClassic from './ResourcesPageClassic';
import ResourcesPageV2 from '../koma/resources-v2/ResourcesPageV2';

export const ResourcesPage = () => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <ResourcesPageV2 /> : <ResourcesPageClassic />;
};

export default ResourcesPage;
