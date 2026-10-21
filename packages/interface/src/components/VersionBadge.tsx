import { memo } from 'react';
import VersionBadgeClassic from './VersionBadgeClassic';
import VersionBadgeNoir from './noir/VersionBadgeNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';

export default memo(createFamilyComponent(VersionBadgeClassic, VersionBadgeNoir));
