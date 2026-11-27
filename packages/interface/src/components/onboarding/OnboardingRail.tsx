import { m } from 'framer-motion';
import { Check, Layers } from 'lucide-react';

import { useI18n } from '../../i18n';
import { KomaNekoActor } from '../koma-mascot/KomaNekoActor';
import { cx } from './onboardingPrimitives';
import { useOnbSkin } from './onboardingSkin';
import { ONBOARDING_STEPS } from './onboardingSteps';
import type { OnboardingController } from './useOnboardingModalController';

const STEP_JP_TAGS: readonly string[] = [
  'スタイル',
  'ハードウェア',
  'モデル導入',
  '処理工程',
  '修復ツール',
  '環境設定',
  '準備完了',
];

function ProgressBar({ percent, label }: { percent: number; label: string }) {
  const skin = useOnbSkin();
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={skin.track}
    >
      <m.div
        className={cx(skin.fill, 'origin-left')}
        initial={false}
        animate={{ scaleX: percent / 100 }}
        transition={{ type: 'spring', stiffness: 180, damping: 26 }}
      />
    </div>
  );
}

export function OnboardingRail({ ctrl }: { ctrl: OnboardingController }) {
  const { t } = useI18n();
  const skin = useOnbSkin();

  return (
    <aside className={cx('hidden w-[248px] shrink-0 flex-col gap-5 p-5 lg:flex', skin.rail)}>
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className={
            skin.noir
              ? 'panel-cut-sm grid h-9 w-9 shrink-0 place-items-center bg-crimson font-display text-xs font-black text-ink'
              : 'koma-onb-c-icon koma-onb-c-icon--lg'
          }
        >
          {skin.noir ? 'コマ' : <Layers size={16} />}
        </span>
        <div className="min-w-0">
          <p className={skin.noir ? 'kicker !text-[9px] !tracking-[0.24em]' : 'koma-onb-c-kicker'}>
            {t('onboarding.kicker')}
          </p>
          <p className={skin.noir ? 'truncate font-display text-sm font-black uppercase tracking-tight text-paper' : 'koma-onb-c-brand'}>
            {t('brand.name')}
            <em className={skin.noir ? 'font-accent font-normal normal-case italic text-crimson' : 'koma-onb-c-accent'}>
              {' '}
              {t('brand.studioSuffix')}
            </em>
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className={skin.hint}>{skin.noir ? STEP_JP_TAGS[ctrl.stepIndex] : t('onboarding.progressLabel')}</span>
          <span className={skin.counter}>{ctrl.progressPercent}%</span>
        </div>
        <ProgressBar percent={ctrl.progressPercent} label={t('onboarding.progressLabel')} />
      </div>

      <nav aria-label={t('onboarding.stepperAria')} className="min-h-0 flex-1 overflow-y-auto">
        <ol className="flex flex-col gap-1">
          {ONBOARDING_STEPS.map((step, index) => {
            const active = index === ctrl.stepIndex;
            const done = index < ctrl.stepIndex;
            return (
              <li key={step.id}>
                <button
                  type="button"
                  data-onb-step={step.id}
                  aria-current={active ? 'step' : undefined}
                  onClick={() => ctrl.setStepIndex(index)}
                  className={cx(
                    'flex w-full items-center gap-3 px-3 py-2.5 text-left',
                    skin.railItem,
                    active ? skin.railItemOn : skin.railItemOff,
                  )}
                >
                  <span aria-hidden="true" className={cx('w-6 shrink-0 text-center', active ? skin.railNumOn : skin.railNum)}>
                    {done ? <Check size={13} strokeWidth={3} className="mx-auto" /> : String(index + 1).padStart(2, '0')}
                  </span>
                  <span className={cx('min-w-0 flex-1 truncate', skin.railLabel)}>{t(step.shortLabelKey)}</span>
                  {done ? <span className="sr-only">{t('onboarding.stepDone')}</span> : null}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <button
        type="button"
        onClick={ctrl.petKoma}
        aria-label={t('onboarding.mascotAria')}
        className={cx(
          'flex flex-col items-center gap-1 py-3',
          skin.noir
            ? 'panel-cut-sm border border-paper/10 bg-ink/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-crimson'
            : 'koma-onb-c-item koma-onb-c-press',
        )}
      >
        <KomaNekoActor pose={ctrl.komaPose} mode={ctrl.komaPetting ? 'interactive' : 'auto'} size={84} />
        <span aria-hidden="true" className={skin.hint}>
          {ctrl.komaPetting ? 'ニャ〜 ♥' : t('onboarding.mascotHint')}
        </span>
      </button>
    </aside>
  );
}

export function OnboardingStepStrip({ ctrl }: { ctrl: OnboardingController }) {
  const { t } = useI18n();
  const skin = useOnbSkin();
  return (
    <nav aria-label={t('onboarding.stepperAria')} className="lg:hidden">
      <ol className="flex gap-1">
        {ONBOARDING_STEPS.map((step, index) => {
          const active = index === ctrl.stepIndex;
          const reached = index <= ctrl.stepIndex;
          return (
            <li key={step.id} className="flex-1">
              <button
                type="button"
                aria-label={`${index + 1}. ${t(step.shortLabelKey)}`}
                aria-current={active ? 'step' : undefined}
                onClick={() => ctrl.setStepIndex(index)}
                className={cx(
                  'block h-6 w-full py-2.5',
                  skin.noir ? 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-crimson' : 'koma-onb-c-stripBtn',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cx(
                    'block h-1 w-full',
                    skin.noir ? (reached ? 'bg-crimson' : 'bg-paper/15') : reached ? 'koma-onb-c-strip--on' : 'koma-onb-c-strip',
                  )}
                />
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
