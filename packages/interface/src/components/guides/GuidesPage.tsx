import { createFamilyComponent } from '@koma/ui/themes/family-skins';
// Guides CSS travels with the guides tree instead of the eager entry bundle.
import '../../pages/guides-resources.css';
import GuidesPageClassic from './GuidesPageClassic';
import GuidesPageV2 from '../koma/guides/GuidesPageV2';

export default createFamilyComponent(GuidesPageClassic, GuidesPageV2);
