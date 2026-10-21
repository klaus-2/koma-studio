import TranslatorTextStageClassic from './TranslatorTextStageClassic';
import TranslatorTextStageNoir from './noir/TranslatorTextStageNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';

const TranslatorTextStage = createFamilyComponent(TranslatorTextStageClassic, TranslatorTextStageNoir);

export default TranslatorTextStage;
