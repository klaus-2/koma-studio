export type OnboardingStepId =
  | 'welcome'
  | 'models-guide'
  | 'install-models'
  | 'aio-stages'
  | 'tools-healing'
  | 'settings'
  | 'finish';

export interface OnboardingStepMeta {
  id: OnboardingStepId;
  index: number;
  titleKey: string;
  shortLabelKey: string;
  subtitleKey: string;
}

export const ONBOARDING_STEPS: readonly OnboardingStepMeta[] = [
  {
    id: 'welcome',
    index: 0,
    titleKey: 'onboarding.steps.welcome.title',
    shortLabelKey: 'onboarding.steps.welcome.short',
    subtitleKey: 'onboarding.steps.welcome.subtitle',
  },
  {
    id: 'models-guide',
    index: 1,
    titleKey: 'onboarding.steps.modelsGuide.title',
    shortLabelKey: 'onboarding.steps.modelsGuide.short',
    subtitleKey: 'onboarding.steps.modelsGuide.subtitle',
  },
  {
    id: 'install-models',
    index: 2,
    titleKey: 'onboarding.steps.installModels.title',
    shortLabelKey: 'onboarding.steps.installModels.short',
    subtitleKey: 'onboarding.steps.installModels.subtitle',
  },
  {
    id: 'aio-stages',
    index: 3,
    titleKey: 'onboarding.steps.aioStages.title',
    shortLabelKey: 'onboarding.steps.aioStages.short',
    subtitleKey: 'onboarding.steps.aioStages.subtitle',
  },
  {
    id: 'tools-healing',
    index: 4,
    titleKey: 'onboarding.steps.toolsHealing.title',
    shortLabelKey: 'onboarding.steps.toolsHealing.short',
    subtitleKey: 'onboarding.steps.toolsHealing.subtitle',
  },
  {
    id: 'settings',
    index: 5,
    titleKey: 'onboarding.steps.settings.title',
    shortLabelKey: 'onboarding.steps.settings.short',
    subtitleKey: 'onboarding.steps.settings.subtitle',
  },
  {
    id: 'finish',
    index: 6,
    titleKey: 'onboarding.steps.finish.title',
    shortLabelKey: 'onboarding.steps.finish.short',
    subtitleKey: 'onboarding.steps.finish.subtitle',
  },
];

export const KOMA_GITHUB_REPO_URL = 'https://github.com/klaus-2/koma-studio';
