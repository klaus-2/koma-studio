import { InstallAllConfirmationClassic } from './InstallAllConfirmationClassic';
import { InstallAllConfirmationNoir } from './noir/InstallAllConfirmationNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';

export type { InstallAllConfirmationProps } from './InstallAllConfirmationClassic';

export const InstallAllConfirmation = createFamilyComponent(InstallAllConfirmationClassic, InstallAllConfirmationNoir);

export default InstallAllConfirmation;
