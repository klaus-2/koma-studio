import { createFamilyComponent } from '@koma/ui/themes/family-skins';
import KlSliderClassic from './KlSliderClassic';
import KlSliderNoir from './noir/KlSliderNoir';
import { memo } from 'react';

export type { KlSliderProps } from './KlSliderClassic';

export default memo(createFamilyComponent(KlSliderClassic, KlSliderNoir));
