import { RegionMultiSelectionActionBarClassic } from './RegionMultiSelectionActionBarClassic';
import { RegionMultiSelectionActionBarNoir } from './noir/RegionMultiSelectionActionBarNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';

export {
  useRegionMultiSelectionActions,
  type RegionMultiSelectionActionBarProps,
  type RegionMultiSelectionActions,
} from './RegionMultiSelectionActionBar.controller';

export const RegionMultiSelectionActionBar = createFamilyComponent(
  RegionMultiSelectionActionBarClassic,
  RegionMultiSelectionActionBarNoir,
);

export default RegionMultiSelectionActionBar;
