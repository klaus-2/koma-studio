import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { ChevronLeft, ChevronRight, Download, SkipForward, X } from 'lucide-react';

import { useI18n } from '../../i18n';
import { useModelManagerLiveState } from '../../hooks/useModelManager';
import type { SettingsTab } from '../../pages/settings/settings.types';
import { writeOnboardingState } from './onboardingStorage';
import {
  KOMA_GITHUB_REPO_URL,
  ONBOARDING_STEPS,
  type OnboardingStepId,
} from './onboardingSteps';
import { OnboardingAioStagesStep } from './steps/OnboardingAioStagesStep';
import { OnboardingFinishStep } from './steps/OnboardingFinishStep';
import { OnboardingInstallModelsStep } from './steps/OnboardingInstallModelsStep';
import { OnboardingModelsGuideStep } from './steps/OnboardingModelsGuideStep';
import { OnboardingSettingsStep } from './steps/OnboardingSettingsStep';
import { OnboardingToolsHealingStep } from './steps/OnboardingToolsHealingStep';
import { OnboardingWelcomeStep } from './steps/OnboardingWelcomeStep';
import './OnboardingModal.css';

export interface OnboardingModalProps {
  open: boolean;
  userId?: string | null;
  githubUrl?: string;
  onClose: () => void;
  onStartTour: () => void;
  onOpenSettingsTab: (tab: SettingsTab) => void;
  onOpenExternalUrl: (event: MouseEvent<HTMLElement>, url: string) => void | Promise<void>;
  onOpenModelManager?: () => void;
  onInstallModels?: (modelIds?: string[]) => Promise<unknown>;
  onRetryModel?: (modelId: string) => Promise<void>;
  onCancelModel?: (modelId: string) => Promise<void>;
  onCancelAllModels?: () => Promise<void>;
}

const isEditableElement = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  );
};

export function OnboardingModal({
  open,
  userId = null,
  githubUrl = KOMA_GITHUB_REPO_URL,
  onClose,
  onStartTour,
  onOpenSettingsTab,
  onOpenExternalUrl,
  onOpenModelManager,
  onInstallModels,
  onRetryModel,
  onCancelModel,
  onCancelAllModels,
}: OnboardingModalProps) {
  const { t } = useI18n();
  const [stepIndex, setStepIndex] = useState(0);
  const { entries } = useModelManagerLiveState();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (open) {
      setStepIndex(0);
      window.requestAnimationFrame(() => {
        closeButtonRef.current?.focus();
      });
    }
  }, [open]);

  const currentStep = ONBOARDING_STEPS[stepIndex] ?? ONBOARDING_STEPS[0];
  const currentStepId: OnboardingStepId = currentStep?.id ?? 'welcome';

  const activeDownloadCount = useMemo(
    () =>
      Object.values(entries).filter(
        (entry) =>
          entry.status === 'downloading' ||
          entry.status === 'queued' ||
          entry.status === 'verifying',
      ).length,
    [entries],
  );

  const handleDismiss = useCallback(() => {
    writeOnboardingState(userId, 'dismissed', currentStepId);
    onClose();
  }, [currentStepId, onClose, userId]);

  const handleCompleteOnly = useCallback(() => {
    writeOnboardingState(userId, 'completed', 'finish');
    onClose();
  }, [onClose, userId]);

  const handleCompleteAndTour = useCallback(() => {
    writeOnboardingState(userId, 'completed', 'finish');
    onClose();
    window.setTimeout(() => {
      onStartTour();
    }, 60);
  }, [onClose, onStartTour, userId]);

  const handleOpenSettingsFromStep = useCallback(
    (tab: SettingsTab) => {
      writeOnboardingState(userId, 'dismissed', currentStepId);
      onClose();
      onOpenSettingsTab(tab);
    },
    [currentStepId, onClose, onOpenSettingsTab, userId],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleDismiss();
        return;
      }

      if (event.altKey && !isEditableElement(event.target)) {
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          setStepIndex((prev) =>
            Math.min(ONBOARDING_STEPS.length - 1, prev + 1),
          );
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          setStepIndex((prev) => Math.max(0, prev - 1));
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleDismiss, open]);

  if (!open || !currentStep) {
    return null;
  }

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === ONBOARDING_STEPS.length - 1;

  return (
    <div
      className="koma-onb-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          handleDismiss();
        }
      }}
    >
      <div
        className="koma-onb-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="koma-onb-dialog-title"
      >
        <header className="koma-onb-header">
          <div className="koma-onb-header__top">
            <div className="koma-onb-brand">
              <span className="koma-onb-brand__kicker">{t('onboarding.kicker')}</span>
              <h2 id="koma-onb-dialog-title" className="koma-onb-title">
                {t(currentStep.titleKey)}
              </h2>
              <p className="koma-onb-subtitle">{t(currentStep.subtitleKey)}</p>
            </div>

            <div className="koma-onb-header__actions">
              {activeDownloadCount > 0 ? (
                <div className="koma-onb-downloadPill" role="status">
                  <Download size={12} />
                  <span>
                    {t('onboarding.header.activeDownloads', {
                      count: activeDownloadCount,
                    })}
                  </span>
                </div>
              ) : null}

              <button
                ref={closeButtonRef}
                type="button"
                className="koma-onb-closeBtn"
                aria-label={t('onboarding.actions.closeAria')}
                onClick={handleDismiss}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <nav
            className="koma-onb-stepper"
            aria-label={t('onboarding.stepperAria')}
          >
            {ONBOARDING_STEPS.map((step, index) => {
              const active = index === stepIndex;
              const done = index < stepIndex;
              return (
                <button
                  key={step.id}
                  type="button"
                  aria-current={active ? 'step' : undefined}
                  onClick={() => setStepIndex(index)}
                  className={`koma-onb-stepBtn ${
                    active ? 'koma-onb-stepBtn--active' : done ? 'koma-onb-stepBtn--done' : ''
                  }`}
                >
                  <span className="koma-onb-stepBtn__num">{index + 1}</span>
                  <span className="koma-onb-stepBtn__label">{t(step.shortLabelKey)}</span>
                </button>
              );
            })}
          </nav>
        </header>

        <div className="koma-onb-body">
          {currentStepId === 'welcome' && <OnboardingWelcomeStep />}
          {currentStepId === 'models-guide' && (
            <OnboardingModelsGuideStep onOpenSettingsTab={handleOpenSettingsFromStep} />
          )}
          {currentStepId === 'install-models' && (
            <OnboardingInstallModelsStep
              onInstallModels={onInstallModels}
              onRetryModel={onRetryModel}
              onCancelModel={onCancelModel}
              onCancelAllModels={onCancelAllModels}
              onOpenModelManager={onOpenModelManager}
            />
          )}
          {currentStepId === 'aio-stages' && <OnboardingAioStagesStep />}
          {currentStepId === 'tools-healing' && <OnboardingToolsHealingStep />}
          {currentStepId === 'settings' && (
            <OnboardingSettingsStep onOpenSettingsTab={handleOpenSettingsFromStep} />
          )}
          {currentStepId === 'finish' && (
            <OnboardingFinishStep
              githubUrl={githubUrl}
              onOpenExternalUrl={onOpenExternalUrl}
              onFinishAndStartTour={handleCompleteAndTour}
              onFinishOnly={handleCompleteOnly}
            />
          )}
        </div>

        <footer className="koma-onb-footer">
          <div className="koma-onb-footer__group">
            <button
              type="button"
              className="koma-onb-btn koma-onb-btn--ghost"
              disabled={isFirst}
              onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
            >
              <ChevronLeft size={14} />
              <span>{t('onboarding.actions.prev')}</span>
            </button>
            <span className="koma-onb-stepCounter">
              {stepIndex + 1} / {ONBOARDING_STEPS.length}
            </span>
          </div>

          <div className="koma-onb-footer__group">
            <button
              type="button"
              className="koma-onb-btn koma-onb-btn--ghost"
              onClick={handleDismiss}
            >
              <SkipForward size={14} />
              <span>{t('onboarding.actions.skip')}</span>
            </button>

            {!isLast ? (
              <button
                type="button"
                className="koma-onb-btn koma-onb-btn--primary"
                onClick={() =>
                  setStepIndex((prev) =>
                    Math.min(ONBOARDING_STEPS.length - 1, prev + 1),
                  )
                }
              >
                <span>{t('onboarding.actions.next')}</span>
                <ChevronRight size={14} />
              </button>
            ) : null}
          </div>
        </footer>
      </div>
    </div>
  );
}

export default OnboardingModal;
