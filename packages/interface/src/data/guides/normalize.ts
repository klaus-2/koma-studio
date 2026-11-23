

import type {
  GuideSection,
  GuideSectionDraft,
  GuideStepDraft,
  GuideStepType,
} from '../guides-types';

export const inferGuideStepType = (
  step: GuideStepDraft,
): GuideStepType => {
  if (step.type) return step.type;
  if (step.warning) return 'warning';
  if (step.tip) return 'tip';
  if (step.code) return 'code';
  if (step.image) return 'image';
  if (step.checklist) return 'checklist';
  if (step.shortcuts) return 'shortcut-table';
  return 'text';
};

export const normalizeGuideSections = (
  guideId: string,
  sections: GuideSectionDraft[],
): GuideSection[] =>
  sections.map((section) => ({
    ...section,
    steps: section.steps.map((step, index) => ({
      ...step,
      id: step.id ?? `${guideId}-${section.id}-${index + 1}`,
      type: inferGuideStepType(step),
    })),
  }));
