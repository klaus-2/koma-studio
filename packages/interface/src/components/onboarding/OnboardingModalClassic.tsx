import { createPortal } from 'react-dom';
import { m } from 'framer-motion';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Layers,
  SkipForward,
  Sparkles,
  X,
} from 'lucide-react';

import { useI18n } from '../../i18n';
import { KomaNekoActor } from '../koma-mascot/KomaNekoActor';
import { ONBOARDING_STEPS } from './onboardingSteps';
import {
  useOnboardingModalController,
  type OnboardingModalProps,
} from './useOnboardingModalController';
import { OnboardingAioStagesStep } from './steps/OnboardingAioStagesStep';
import { OnboardingFinishStep } from './steps/OnboardingFinishStep';
import { OnboardingInstallModelsStep } from './steps/OnboardingInstallModelsStep';
import { OnboardingModelsGuideStep } from './steps/OnboardingModelsGuideStep';
import { OnboardingSettingsStep } from './steps/OnboardingSettingsStep';
import { OnboardingToolsHealingStep } from './steps/OnboardingToolsHealingStep';
import { OnboardingWelcomeStep } from './steps/OnboardingWelcomeStep';

const EASE = [0.22, 1, 0.36, 1] as const;

export function OnboardingModalClassic(props: OnboardingModalProps) {
  const { open, onOpenExternalUrl, onOpenModelManager, onInstallModels, onRetryModel, onCancelModel, onCancelAllModels } = props;
  const { t } = useI18n();
  const ctrl = useOnboardingModalController(props);

  if (!open) {
    return null;
  }

  const modalNode = (
    <div
      className="koma-onb-overlay koma-onb-overlay--classic"
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
        data-onboarding-theme="classic"
        initial={{ opacity: 0, y: 18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: EASE }}
        className="koma-onb-shell koma-onb-shell--classic"
      >

        <span aria-hidden="true" className="koma-onb-classicStripe" />

        <aside className="koma-onb-rail koma-onb-rail--classic">
          <div className="koma-onb-rail__brand">
            <div className="koma-onb-classicBrand">
              <span className="koma-onb-classicBrand__icon" aria-hidden="true">
                <Layers size={16} />
              </span>
              <div className="min-w-0">
                <span className="koma-onb-classicBrand__kicker">{t('onboarding.kicker')}</span>
                <p className="koma-onb-classicBrand__name">
                  {t('brand.name')} <span>{t('brand.studioSuffix')}</span>
                </p>
              </div>
            </div>

            <div className="koma-onb-progressMeta">
              <span className="koma-onb-muted" style={{ margin: 0 }}>
                {ctrl.stepIndex + 1} / {ONBOARDING_STEPS.length}
              </span>
              <span className="koma-onb-mono koma-onb-classicPct">{ctrl.progressPercent}%</span>
            </div>
            <div className="koma-onb-railBar" aria-hidden="true">
              <m.div
                className="koma-onb-railBar__fill koma-onb-railBar__fill--classic"
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
                  className={`koma-onb-railItem koma-onb-railItem--classic ${
                    active
                      ? 'koma-onb-railItem--active'
                      : done
                        ? 'koma-onb-railItem--done'
                        : ''
                  }`}
                >
                  <span className="koma-onb-railItem__num">
                    {done ? <Check size={11} strokeWidth={3} /> : index + 1}
                  </span>
                  <span className="koma-onb-railItem__copy">
                    <span className="koma-onb-railItem__label">{t(step.shortLabelKey)}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="koma-onb-mascotDock koma-onb-mascotDock--classic">
            <button
              type="button"
              onClick={ctrl.petKoma}
              aria-label="Koma Neeko"
              className="koma-onb-mascotBtn"
            >
              <KomaNekoActor
                pose={ctrl.komaPose}
                mode={ctrl.komaPetting ? 'interactive' : 'auto'}
                size={90}
              />
            </button>
            <div className="koma-onb-mascotTag">
              <Sparkles size={11} className="koma-onb-classicSpark" aria-hidden="true" />
              <span>{ctrl.komaPetting ? 'Purr~ ♥' : `Koma · ${ctrl.komaPose}`}</span>
            </div>
          </div>
        </aside>

        <div className="koma-onb-main">
          <header className="koma-onb-topBar koma-onb-topBar--classic">
            <div className="min-w-0 flex-1">
              <div className="koma-onb-classicStepRow">
                <span className="koma-onb-classicStepPill">
                  {String(ctrl.stepIndex + 1).padStart(2, '0')} · {t(ctrl.currentStep.shortLabelKey)}
                </span>
                {ctrl.activeDownloadCount > 0 && (
                  <span className="koma-onb-downloadPill" role="status">
                    <Download size={12} />
                    <span>
                      {t('onboarding.header.activeDownloads', {
                        count: ctrl.activeDownloadCount,
                      })}
                    </span>
                  </span>
                )}
              </div>
              <h2 id="koma-onb-dialog-title" className="koma-onb-title">
                {t(ctrl.currentStep.titleKey)}
              </h2>
              <p className="koma-onb-subtitle">{t(ctrl.currentStep.subtitleKey)}</p>
            </div>

            <button
              ref={ctrl.closeButtonRef}
              type="button"
              className="koma-onb-closeBtn"
              aria-label={t('onboarding.actions.closeAria')}
              onClick={ctrl.handleDismiss}
            >
              <X size={15} />
            </button>
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

          <footer className="koma-onb-footer koma-onb-footer--classic">
            <div className="koma-onb-footer__group">
              <button
                type="button"
                className="koma-onb-btn koma-onb-btn--ghost"
                disabled={ctrl.isFirst}
                onClick={ctrl.goPrev}
              >
                <ChevronLeft size={14} />
                <span>{t('onboarding.actions.prev')}</span>
              </button>
              <span className="koma-onb-stepCounter">
                {ctrl.stepIndex + 1} / {ONBOARDING_STEPS.length}
              </span>
            </div>

            <div className="koma-onb-footer__group">
              <button
                type="button"
                className="koma-onb-btn koma-onb-btn--ghost"
                onClick={ctrl.handleDismiss}
              >
                <SkipForward size={14} />
                <span>{t('onboarding.actions.skip')}</span>
              </button>

              {!ctrl.isLast && (
                <button
                  type="button"
                  className="koma-onb-btn koma-onb-btn--primary"
                  onClick={ctrl.goNext}
                >
                  <span>{t('onboarding.actions.next')}</span>
                  <ChevronRight size={14} />
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

export default OnboardingModalClassic;
