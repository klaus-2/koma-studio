import { CloseGuardModalClassic } from './CloseGuardModalClassic';
import { CloseGuardModalNoir } from './noir/CloseGuardModalNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';

export type { CloseGuardModalProps } from './CloseGuardModalClassic';

export const CloseGuardModal = createFamilyComponent(
  CloseGuardModalClassic,
  CloseGuardModalNoir,
);

export default CloseGuardModal;
