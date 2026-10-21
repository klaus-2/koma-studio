import { createFamilyComponent } from '@koma/ui/themes/family-skins';
import ResourcesPageClassic from './ResourcesPageClassic';
import ResourcesPageV2 from '../koma/resources-v2/ResourcesPageV2';

export const ResourcesPage = createFamilyComponent(
  ResourcesPageClassic,
  ResourcesPageV2,
);

export default ResourcesPage;
