import { createFamilyComponent } from '@koma/ui/themes/family-skins';
import TranslatorWorkspaceToggleClassic from './TranslatorWorkspaceToggleClassic';
import { TranslatorWorkspaceToggleNoir } from './noir/TranslatorWorkspaceToggleNoir';

export const TranslatorWorkspaceToggle = createFamilyComponent(
  TranslatorWorkspaceToggleClassic,
  TranslatorWorkspaceToggleNoir,
);
