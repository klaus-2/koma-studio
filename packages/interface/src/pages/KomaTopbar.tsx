import { memo } from 'react';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';
import KomaTopbarClassic from './KomaTopbarClassic';
import KomaTopbarNoir from './KomaTopbarNoir';

const KomaTopbar = memo(createFamilyComponent(KomaTopbarClassic, KomaTopbarNoir));

export default KomaTopbar;