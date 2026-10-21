import { createFamilyComponent } from '@koma/ui/themes/family-skins';
import ModelRankingsPageClassic from './ModelRankingsClassic';
import { ModelRankingsPage as ModelRankingsPageNoir } from './noir/ModelRankingsNoir';

export const ModelRankingsPage = createFamilyComponent(
  ModelRankingsPageClassic,
  ModelRankingsPageNoir,
);

export default ModelRankingsPage;
