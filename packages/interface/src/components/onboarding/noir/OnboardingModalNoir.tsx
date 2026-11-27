import { createPortal } from 'react-dom';
import { m } from 'framer-motion';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  SkipForward,
  Sparkles,
  X,
} from 'lucide-react';

import { useI18n } from '../../../i18n';
import { KomaNekoActor } from '../../koma-mascot/KomaNekoActor';
import { EASE, btnGhost, btnPrimary } from '../../system/v2/kit';
import { ONBOARDING_STEPS } from '../onboardingSteps';
import {
  useOnboardingModalController,
  type OnboardingModalProps,
} from '../useOnboardingModalController';
import { OnboardingAioStagesStep } from '../steps/OnboardingAioStagesStep';
import { OnboardingFinishStep } from '../steps/OnboardingFinishStep';
import { OnboardingInstallModelsStep } from '../steps/OnboardingInstallModelsStep';
import { OnboardingModelsGuideStep } from '../steps/OnboardingModelsGuideStep';
import { OnboardingSettingsStep } from '../steps/OnboardingSettingsStep';
import { OnboardingToolsHealingStep } from '../steps/OnboardingToolsHealingStep';
import { OnboardingWelcomeStep } from '../steps/OnboardingWelcomeStep';

const STEP_JP_TAGS: readonly string[] = [
  'スタイル',
  'ハードウェア',
  'モデル導入',
  '処理工程',
  '修復ツール',
  '環境設定',
  '準備完了',
];

export function OnboardingModalNoir(props: OnboardingModalProps) {
  const { open, onOpenExternalUrl, onOpenModelManager, onInstallModels, onRetryModel, onCancelModel, onCancelAllModels } = props;
  const { t } = useI18n();
  const ctrl = useOnboardingModalController(props);

  if (!open) {
    return null;
  }

  const titleWords = t(ctrl.currentStep.titleKey).split(' ');
  const titleHead = titleWords.slice(0, -1).join(' ');
  const titleTail = titleWords[titleWords.length - 1] ?? '';

  const modalNode = (
    <div
      className="koma-onb-overlay koma-onb-overlay--noir"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          ctrl.handleDismiss();
        }
      }}
    >
      <m.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="koma-onb-dialog-title"
        data-onboarding-theme="noir"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.36, ease: EASE }}
        className="koma-onb-shell koma-onb-shell--noir glass panel-cut halftone"
      >

        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 z-20 h-[3px] w-full bg-gradient-to-r from-crimson via-gold/70 to-transparent"
        />

        <span
          aria-hidden="true"
          className="v-text pointer-events-none absolute bottom-14 right-2 z-0 select-none font-display text-2xl font-black tracking-[0.26em] text-paper/[0.045]"
        >
          初回ガイド — KOMA
        </span>

        <aside className="koma-onb-rail koma-onb-rail--noir">
          <div className="koma-onb-rail__brand">
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="panel-cut-sm grid h-9 w-9 shrink-0 place-items-center bg-crimson font-display text-xs font-black text-ink shadow-hard-gold"
              >
                コマ
              </span>
              <div className="min-w-0">
                <p className="kicker !text-[9px] !tracking-[0.24em]">{t('onboarding.kicker')}</p>
                <p className="truncate font-display text-sm font-black uppercase tracking-tight text-paper">
                  {t('brand.name')}
                  <em className="font-accent font-normal normal-case italic text-crimson">
                    {' '}
                    {t('brand.studioSuffix')}
                  </em>
                </p>
              </div>
            </div>

            <div className="koma-onb-progressMeta">
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-paper/45">
                {STEP_JP_TAGS[ctrl.stepIndex] ?? 'KOMA'}
              </span>
              <span className="font-mono text-[10px] font-bold text-gold">
                {ctrl.progressPercent}%
              </span>
            </div>
            <div className="koma-onb-railBar" aria-hidden="true">
              <m.div
                className="koma-onb-railBar__fill koma-onb-railBar__fill--noir"
                initial={false}
                animate={{ scaleX: ctrl.progressPercent / 100 }}
                transition={{ type: 'spring', stiffness: 180, damping: 24 }}
              />
            </div>
          </div>

          <nav
            className="koma-onb-railNav"
            aria-label={t('onboarding.stepperAria')}
          >
            {ONBOARDING_STEPS.map((step, index) => {
              const active = index === ctrl.stepIndex;
              const done = index < ctrl.stepIndex;
              return (
                <button
                  key={step.id}
                  type="button"
                  aria-current={active ? 'step' : undefined}
                  onClick={() => ctrl.setStepIndex(index)}
                  className={`koma-onb-railItem koma-onb-railItem--noir ${
                    active
                      ? 'koma-onb-railItem--active'
                      : done
                        ? 'koma-onb-railItem--done'
                        : ''
                  }`}
                >
                  <span className="koma-onb-railItem__num">
                    {done ? <Check size={11} strokeWidth={3} /> : String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="koma-onb-railItem__copy">
                    <span className="koma-onb-railItem__label">{t(step.shortLabelKey)}</span>
                  </span>
                  {active && <span className="koma-onb-railItem__dot" aria-hidden="true" />}
                </button>
              );
            })}
          </nav>

          <div className="koma-onb-mascotDock koma-onb-mascotDock--noir">
            <button
              type="button"
              onClick={ctrl.petKoma}
              aria-label="Koma Neeko"
              className="koma-onb-mascotBtn"
            >
              <KomaNekoActor
                pose={ctrl.komaPose}
                mode={ctrl.komaPetting ? 'interactive' : 'auto'}
                size={94}
              />
            </button>
            <div className="koma-onb-mascotTag">
              <Sparkles size={10} className="text-gold shrink-0" aria-hidden="true" />
              <span className="truncate font-mono text-[9px] uppercase tracking-[0.16em] text-paper/65">
                {ctrl.komaPetting ? 'ニャ〜 ♥' : `KOMA · ${ctrl.komaPose.toUpperCase()}`}
              </span>
            </div>
          </div>
        </aside>

        <div className="koma-onb-main">
          <header className="koma-onb-topBar koma-onb-topBar--noir">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-crimson">
                  // {String(ctrl.stepIndex + 1).padStart(2, '0')} · {t(ctrl.currentStep.shortLabelKey)}
                </span>
                {ctrl.activeDownloadCount > 0 && (
                  <span className="koma-onb-downloadPill koma-onb-downloadPill--noir" role="status">
                    <Download size={11} />
                    <span>
                      {t('onboarding.header.activeDownloads', {
                        count: ctrl.activeDownloadCount,
                      })}
                    </span>
                  </span>
                )}
              </div>
              <h2
                id="koma-onb-dialog-title"
                className="mt-1 font-display text-xl font-black uppercase leading-tight tracking-tight text-paper sm:text-2xl"
              >
                {titleHead ? <span>{titleHead} </span> : null}
                <em className="font-accent font-normal normal-case italic text-crimson">
                  {titleTail}
                </em>
              </h2>
              <p className="mt-0.5 font-mono text-[11px] text-paper/55">
                {t(ctrl.currentStep.subtitleKey)}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span
                aria-hidden="true"
                className="text-outline hidden select-none font-display text-4xl font-black leading-none sm:inline"
              >
                {String(ctrl.stepIndex + 1).padStart(2, '0')}
              </span>
              <button
                ref={ctrl.closeButtonRef}
                type="button"
                aria-label={t('onboarding.actions.closeAria')}
                onClick={ctrl.handleDismiss}
                className="panel-cut-sm hard-hover mr-2 border border-paper/15 p-2 text-paper/55 transition-colors hover:border-crimson/60 hover:text-crimson focus-visible:outline focus-visible:outline-2 focus-visible:outline-crimson"
              >
                <X size={15} />
              </button>
            </div>
          </header>

          <div className="koma-onb-body custom-scrollbar">
            <m.div
              key={ctrl.currentStepId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: EASE }}
            >
              {ctrl.currentStepId === 'welcome' && <OnboardingWelcomeStep />}
              {ctrl.currentStepId === 'models-guide' && (
                <OnboardingModelsGuideStep onOpenSettingsTab={ctrl.handleOpenSettingsFromStep} />
              )}
              {ctrl.currentStepId === 'install-models' && (
                <OnboardingInstallModelsStep
                  onInstallModels={onInstallModels}
                  onRetryModel={onRetryModel}
                  onCancelModel={onCancelModel}
                  onCancelAllModels={onCancelAllModels}
                  onOpenModelManager={onOpenModelManager}
                />
              )}
              {ctrl.currentStepId === 'aio-stages' && <OnboardingAioStagesStep />}
              {ctrl.currentStepId === 'tools-healing' && <OnboardingToolsHealingStep />}
              {ctrl.currentStepId === 'settings' && (
                <OnboardingSettingsStep onOpenSettingsTab={ctrl.handleOpenSettingsFromStep} />
              )}
              {ctrl.currentStepId === 'finish' && (
                <OnboardingFinishStep
                  githubUrl={ctrl.githubUrl}
                  onOpenExternalUrl={onOpenExternalUrl}
                  onFinishAndStartTour={ctrl.handleCompleteAndTour}
                  onFinishOnly={ctrl.handleCompleteOnly}
                />
              )}
            </m.div>
          </div>

          <footer className="koma-onb-footer koma-onb-footer--noir">
            <div className="koma-onb-footer__group">
              <button
                type="button"
                className={btnGhost}
                disabled={ctrl.isFirst}
                onClick={ctrl.goPrev}
              >
                <ChevronLeft size={13} />
                <span>{t('onboarding.actions.prev')}</span>
              </button>
              <span className="koma-onb-stepCounter">
                {ctrl.stepIndex + 1} / {ONBOARDING_STEPS.length}
              </span>
            </div>

            <div className="koma-onb-footer__group">
              <button
                type="button"
                className={btnGhost}
                onClick={ctrl.handleDismiss}
              >
                <SkipForward size={13} />
                <span>{t('onboarding.actions.skip')}</span>
              </button>

              {!ctrl.isLast && (
                <button
                  type="button"
                  className={btnPrimary}
                  onClick={ctrl.goNext}
                >
                  <span>{t('onboarding.actions.next')}</span>
                  <ChevronRight size={13} />
                </button>
              )}
            </div>
          </footer>
        </div>
      </m.div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : modalNode;
}

export default OnboardingModalNoir;
