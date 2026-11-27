import { OnboardingAioStagesStep } from './steps/OnboardingAioStagesStep';
import { OnboardingFinishStep } from './steps/OnboardingFinishStep';
import { OnboardingInstallModelsStep } from './steps/OnboardingInstallModelsStep';
import { OnboardingModelsGuideStep } from './steps/OnboardingModelsGuideStep';
import { OnboardingSettingsStep } from './steps/OnboardingSettingsStep';
import { OnboardingToolsHealingStep } from './steps/OnboardingToolsHealingStep';
import { OnboardingWelcomeStep } from './steps/OnboardingWelcomeStep';
import type { OnboardingController, OnboardingModalProps } from './useOnboardingModalController';

export function OnboardingStepContent({
  ctrl,
  modalProps,
}: {
  ctrl: OnboardingController;
  modalProps: OnboardingModalProps;
}) {
  switch (ctrl.currentStepId) {
    case 'welcome':
      return <OnboardingWelcomeStep />;
    case 'models-guide':
      return <OnboardingModelsGuideStep onOpenSettingsTab={ctrl.handleOpenSettingsFromStep} />;
    case 'install-models':
      return (
        <OnboardingInstallModelsStep
          onInstallModels={modalProps.onInstallModels}
          onRetryModel={modalProps.onRetryModel}
          onCancelModel={modalProps.onCancelModel}
          onCancelAllModels={modalProps.onCancelAllModels}
          onOpenModelManager={modalProps.onOpenModelManager}
        />
      );
    case 'aio-stages':
      return <OnboardingAioStagesStep />;
    case 'tools-healing':
      return <OnboardingToolsHealingStep />;
    case 'settings':
      return <OnboardingSettingsStep onOpenSettingsTab={ctrl.handleOpenSettingsFromStep} />;
    case 'finish':
      return (
        <OnboardingFinishStep
          githubUrl={ctrl.githubUrl}
          onOpenExternalUrl={modalProps.onOpenExternalUrl}
          onFinishAndStartTour={ctrl.handleCompleteAndTour}
          onFinishOnly={ctrl.handleCompleteOnly}
          onEditStep={ctrl.goToStep}
        />
      );
  }
}
