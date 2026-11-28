import { useState } from 'react';
import { CheckCircle2, ChevronDown, Sparkles } from 'lucide-react';

import {
  DockToolAnimatedPreview,
  type DockToolPreviewKind,
} from '../../../features/dashboard/components/DockToolAnimatedPreview';
import { useI18n } from '../../../i18n';
import { OnbBadge, OnbNotice, OnbSection, cx } from '../onboardingPrimitives';
import { useOnbSkin } from '../onboardingSkin';
import { AreaCanvasLabSandbox } from '../interactive-tools/AreaCanvasLabSandbox';
import { HealingLabSandbox } from '../interactive-tools/HealingLabSandbox';
import {
  areAllMissionsComplete,
  countCompletedMissions,
  createInitialCompletion,
  type InteractiveMissionId,
  type InteractiveToolsCompletion,
} from '../interactive-tools/InteractiveToolsTypes';
import { MissionProgressStrip } from '../interactive-tools/InteractiveTourChrome';
import { RefineTextLabSandbox } from '../interactive-tools/RefineTextLabSandbox';

interface ToolCardSpec {
  readonly kind: DockToolPreviewKind;
  readonly key: string;
}

const REFERENCE_TOOLS: readonly ToolCardSpec[] = [
  { kind: 'healing', key: 'healing' },
  { kind: 'magic-wand', key: 'magicWand' },
  { kind: 'segment-brush', key: 'segmentBrush' },
  { kind: 'segment-eraser', key: 'segmentEraser' },
  { kind: 'paint', key: 'paint' },
  { kind: 'paint-eraser', key: 'paintEraser' },
  { kind: 'clear-paint', key: 'clearPaint' },
  { kind: 'reset-edits', key: 'resetEdits' },
  { kind: 'area-select', key: 'areaSelect' },
  { kind: 'config', key: 'config' },
  { kind: 'clear-page', key: 'clearPage' },
];

export interface OnboardingToolsHealingStepProps {
  completion?: InteractiveToolsCompletion;
  onCompleteMission?: (mission: InteractiveMissionId) => void;
  onCompletionChange?: (doneCount: number, allComplete: boolean) => void;
}

export function OnboardingToolsHealingStep({
  completion: controlledCompletion,
  onCompleteMission,
  onCompletionChange,
}: OnboardingToolsHealingStepProps) {
  const { t } = useI18n();
  const skin = useOnbSkin();
  const variant = skin.noir ? 'noir' : 'classic';

  const [internalCompletion, setInternalCompletion] = useState<InteractiveToolsCompletion>(() =>
    createInitialCompletion(false),
  );
  const [activeMission, setActiveMission] = useState<InteractiveMissionId>('healing');
  const [referenceOpen, setReferenceOpen] = useState(false);

  const completion = controlledCompletion ?? internalCompletion;
  const doneCount = countCompletedMissions(completion);
  const allComplete = areAllMissionsComplete(completion);

  const handleComplete = (mission: InteractiveMissionId): void => {
    const next = { ...completion, [mission]: true };
    if (!controlledCompletion) {
      setInternalCompletion(next);
    }
    onCompleteMission?.(mission);
    onCompletionChange?.(countCompletedMissions(next), areAllMissionsComplete(next));
  };

  return (
    <div className="flex flex-col gap-4">
      <OnbSection
        icon={<Sparkles size={14} />}
        title={t('onboarding.tools.healingFlow.title')}
        desc={t('onboarding.tools.intro')}
        actions={
          <OnbBadge tone={allComplete ? 'success' : 'accent'}>
            {t('onboarding.tools.tourProgress', { done: doneCount, total: 3 })}
          </OnbBadge>
        }
      >
        <div className="flex flex-col gap-3">
          <MissionProgressStrip
            activeMission={activeMission}
            completion={completion}
            onSelectMission={setActiveMission}
          />

          {allComplete ? (
            <OnbNotice tone="success" role="status">
              <CheckCircle2 size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
              <span className="min-w-0 flex-1">
                <strong className="block">{t('onboarding.tools.allDoneTitle')}</strong>
                {t('onboarding.tools.allDoneBody')}
              </span>
            </OnbNotice>
          ) : null}

          <div role="tabpanel" className="outline-none">
            {activeMission === 'healing' ? (
              <HealingLabSandbox
                completed={completion.healing}
                onComplete={() => handleComplete('healing')}
                onNextMission={() => setActiveMission('text')}
                nextMissionLabel={t('onboarding.tools.tab.text')}
              />
            ) : null}

            {activeMission === 'text' ? (
              <RefineTextLabSandbox
                completed={completion.text}
                onComplete={() => handleComplete('text')}
                onNextMission={() => setActiveMission('selection')}
                nextMissionLabel={t('onboarding.tools.tab.selection')}
              />
            ) : null}

            {activeMission === 'selection' ? (
              <AreaCanvasLabSandbox
                active={activeMission === 'selection'}
                completed={completion.selection}
                onComplete={() => handleComplete('selection')}
              />
            ) : null}
          </div>
        </div>
      </OnbSection>

      <div className={cx('flex flex-col gap-2', skin.item, skin.itemOff)}>
        <button
          type="button"
          data-testid="tools-reference-toggle"
          aria-expanded={referenceOpen}
          onClick={() => setReferenceOpen((prev) => !prev)}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span className={skin.itemTitle}>{t('onboarding.tools.referenceToggle')}</span>
          <ChevronDown
            size={14}
            aria-hidden="true"
            className={cx('transition-transform', referenceOpen && 'rotate-180')}
          />
        </button>

        {referenceOpen ? (
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {REFERENCE_TOOLS.map((tool) => (
              <div key={tool.kind} className={cx('flex flex-col gap-1.5', skin.item, skin.itemOff)}>
                <DockToolAnimatedPreview
                  kind={tool.kind}
                  variant={variant}
                  size="card"
                  playMode="hover"
                  label={t(`onboarding.tools.card.${tool.key}Title`)}
                />
                <strong className={cx('block', skin.itemTitle)}>
                  {t(`onboarding.tools.card.${tool.key}Title`)}
                </strong>
                <span className={cx('block', skin.muted)}>
                  {t(`onboarding.tools.card.${tool.key}Desc`)}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
