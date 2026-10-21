import { TypographerPresetBrowserClassic } from './TypographerPresetBrowserClassic';
import { TypographerPresetBrowserNoir } from './noir/TypographerPresetBrowserNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';

export const TypographerPresetBrowser = createFamilyComponent(TypographerPresetBrowserClassic, TypographerPresetBrowserNoir);

export default TypographerPresetBrowser;
