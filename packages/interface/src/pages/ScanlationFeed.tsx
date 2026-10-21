import { createFamilyComponent } from '@koma/ui/themes/family-skins';
import ScanlationFeedPageClassic from './ScanlationFeedClassic';
import { ScanlationFeedPage as ScanlationFeedPageNoir } from './scanlation-feed/noir/ScanlationFeedNoir';

export const ScanlationFeedPage = createFamilyComponent(
  ScanlationFeedPageClassic,
  ScanlationFeedPageNoir,
);

export default ScanlationFeedPage;
