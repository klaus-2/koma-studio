import type { ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bandage,
  BoxSelect,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Type,
} from 'lucide-react';

import { useI18n } from '../../../i18n';
import { OnbBadge, cx } from '../onboardingPrimitives';
import { useOnbSkin } from '../onboardingSkin';
import {
  INTERACTIVE_MISSION_ORDER,
  type InteractiveMissionId,
  type InteractiveToolsCompletion,
} from './InteractiveToolsTypes';

const MISSION_ICON: Record<InteractiveMissionId, typeof Bandage> = {
  healing: Bandage,
  text: Type,
  selection: BoxSelect,
};

const MISSION_LABEL_KEY: Record<InteractiveMissionId, string> = {
  healing: 'onboarding.tools.tab.healing',
  text: 'onboarding.tools.tab.text',
  selection: 'onboarding.tools.tab.selection',
};

export function MissionProgressStrip({
  activeMission,
  completion,
  onSelectMission,
}: {
  activeMission: InteractiveMissionId;
  completion: InteractiveToolsCompletion;
  onSelectMission: (mission: InteractiveMissionId) => void;
}) {
  const { t } = useI18n();
  const skin = useOnbSkin();

  return (
    <div
      role="tablist"
      aria-label={t('onboarding.tools.tabsAria')}
      className="grid gap-2 sm:grid-cols-3"
    >
      {INTERACTIVE_MISSION_ORDER.map((missionId, index) => {
        const Icon = MISSION_ICON[missionId];
        const active = activeMission === missionId;
        const done = completion[missionId];
        return (
          <button
            key={missionId}
            type="button"
            role="tab"
            aria-selected={active}
            data-onb-mission-tab={missionId}
            onClick={() => onSelectMission(missionId)}
            className={cx(
              'flex items-center justify-between gap-2 px-3 py-2 text-left transition-colors',
              skin.item,
              skin.press,
              active ? skin.itemOn : skin.itemOff,
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden="true"
                className={cx(
                  'grid h-6 w-6 shrink-0 place-items-center',
                  done
                    ? skin.noir
                      ? 'border border-mint/50 bg-mint/15 text-mint'
                      : 'rounded-md bg-emerald-500/15 text-emerald-400'
                    : active
                      ? skin.noir
                        ? 'border border-crimson/50 bg-crimson/15 text-crimson'
                        : 'rounded-md bg-purple-500/15 text-purple-300'
                      : skin.noir
                        ? 'border border-paper/15 text-paper/55'
                        : 'rounded-md bg-white/5 text-slate-400',
                )}
              >
                {done ? <CheckCircle2 size={13} /> : <Icon size={13} />}
              </span>
              <span className="min-w-0">
                <span className={cx('block truncate', skin.mono)}>
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className={cx('block truncate', skin.itemTitle)}>
                  {t(MISSION_LABEL_KEY[missionId])}
                </span>
              </span>
            </span>
            {done ? (
              <OnbBadge tone="success">{t('onboarding.tools.missionCompleteBadge')}</OnbBadge>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function GuidedStepBanner({
  stepNumber,
  totalSteps,
  title,
  hint,
  completed,
  errorMessage,
  onReplay,
  nextMissionLabel,
  onNextMission,
}: {
  stepNumber: number;
  totalSteps: number;
  title: string;
  hint: string;
  completed: boolean;
  errorMessage: string | null;
  onReplay: () => void;
  nextMissionLabel?: string;
  onNextMission?: () => void;
}) {
  const { t } = useI18n();
  const skin = useOnbSkin();

  return (
    <div
      className={cx(
        'flex flex-col gap-2',
        skin.item,
        completed ? skin.itemOff : skin.itemOn,
      )}
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {completed ? (
            <OnbBadge tone="success">
              <CheckCircle2 size={11} aria-hidden="true" />
              {t('onboarding.tools.missionCompleteBadge')}
            </OnbBadge>
          ) : (
            <OnbBadge tone="accent">
              <Sparkles size={11} aria-hidden="true" className="koma-onb-tour-beacon" />
              {t('onboarding.tools.stepProgress', { step: stepNumber, total: totalSteps })}
            </OnbBadge>
          )}
          <strong className={skin.itemTitle}>{title}</strong>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" className={skin.btnSmall} onClick={onReplay}>
            <RotateCcw size={11} aria-hidden="true" />
            <span>{t('onboarding.tools.replayMission')}</span>
          </button>
          {completed && onNextMission && nextMissionLabel ? (
            <button type="button" className={skin.btnPrimary} onClick={onNextMission}>
              <span>{t('onboarding.tools.continueNextMission', { next: nextMissionLabel })}</span>
              <ArrowRight size={12} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      <p className={skin.muted}>{hint}</p>

      {errorMessage ? (
        <div role="alert" className={skin.notice('warn')}>
          <AlertTriangle size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      ) : null}
    </div>
  );
}

export function TourTargetRing({
  active,
  children,
  className,
}: {
  active: boolean;
  children: ReactNode;
  className?: string;
}) {
  const skin = useOnbSkin();
  return (
    <div
      data-tour-active={active ? 'true' : 'false'}
      className={cx(
        'relative inline-flex',
        active && 'koma-onb-tour-ring',
        active && (skin.noir ? 'koma-onb-tour-ring--noir' : 'koma-onb-tour-ring--classic'),
        className,
      )}
    >
      {children}
      {active ? (
        <span
          aria-hidden="true"
          className="koma-onb-tour-beacon pointer-events-none absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-current shadow-sm"
        />
      ) : null}
    </div>
  );
}
