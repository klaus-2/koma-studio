import { createFamilyComponent } from '@koma/ui/themes/family-skins';

import OnboardingModalClassic from './OnboardingModalClassic';
import OnboardingModalNoir from './noir/OnboardingModalNoir';
import type { OnboardingModalProps } from './useOnboardingModalController';
import './OnboardingModal.css';

export type { OnboardingModalProps } from './useOnboardingModalController';

export const OnboardingModal = createFamilyComponent<OnboardingModalProps>(
  OnboardingModalClassic,
  OnboardingModalNoir,
);

export default OnboardingModal;
