import { createFamilyComponent } from '@koma/ui/themes/family-skins';
import LegalHubPageClassic from './LegalHubClassic';
import { LegalHubPage as LegalHubPageNoir } from './noir/LegalHubNoir';

export const LegalHubPage = createFamilyComponent(
  LegalHubPageClassic,
  LegalHubPageNoir,
);

export default LegalHubPage;
