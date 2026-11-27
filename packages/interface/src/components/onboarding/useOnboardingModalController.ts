import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react';

import { useModelManagerLiveState } from '../../hooks/useModelManager';
import type { SettingsTab } from '../../pages/settings/settings.types';
import type { KomaPose } from '../../stores/koma-mascot-store';
import { acquireOnboardingModalLock } from './onboardingOpenState';
import { writeOnboardingState } from './onboardingStorage';
import {
  KOMA_GITHUB_REPO_URL,
  ONBOARDING_STEPS,
  type OnboardingStepId,
  type OnboardingStepMeta,
} from './onboardingSteps';

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

const STEP_POSES: Readonly<Record<OnboardingStepId, KomaPose>> = {
  welcome: 'wave',
  'models-guide': 'curious',
  'install-models': 'working',
  'aio-stages': 'peek',
  'tools-healing': 'wink',
  settings: 'idle',
  finish: 'celebrate',
};

export interface OnboardingController {
  stepIndex: number;
  setStepIndex: (index: number) => void;
  goPrev: () => void;
  goNext: () => void;
  currentStep: OnboardingStepMeta;
  currentStepId: OnboardingStepId;
  isFirst: boolean;
  isLast: boolean;
  progressPercent: number;
  activeDownloadCount: number;
  komaPose: KomaPose;
  petKoma: () => void;
  komaPetting: boolean;
  githubUrl: string;
  closeButtonRef: React.RefObject<HTMLButtonElement | null>;
  handleDismiss: () => void;
  handleCompleteOnly: () => void;
  handleCompleteAndTour: () => void;
  handleOpenSettingsFromStep: (tab: SettingsTab) => void;
}

export function useOnboardingModalController({
  open,
  userId = null,
  githubUrl = KOMA_GITHUB_REPO_URL,
  onClose,
  onStartTour,
  onOpenSettingsTab,
}: OnboardingModalProps): OnboardingController {
  const [stepIndex, setStepIndex] = useState(0);
  const [komaPetting, setKomaPetting] = useState(false);
  const petTimerRef = useRef<number | null>(null);
  const { entries } = useModelManagerLiveState();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const releaseLock = acquireOnboardingModalLock();
    setStepIndex(0);
    window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });
    return releaseLock;
  }, [open]);

  useEffect(
    () => () => {
      if (petTimerRef.current !== null) {
        window.clearTimeout(petTimerRef.current);
      }
    },
    [],
  );

  const fallbackStep: OnboardingStepMeta = {
    id: 'welcome',
    index: 0,
    titleKey: 'onboarding.steps.welcome.title',
    shortLabelKey: 'onboarding.steps.welcome.short',
    subtitleKey: 'onboarding.steps.welcome.subtitle',
  };
  const currentStep: OnboardingStepMeta =
    ONBOARDING_STEPS[stepIndex] ?? ONBOARDING_STEPS[0] ?? fallbackStep;
  const currentStepId: OnboardingStepId = currentStep.id;

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

  const hasFailedDownload = useMemo(
    () => Object.values(entries).some((entry) => entry.status === 'failed'),
    [entries],
  );

  const komaPose: KomaPose = useMemo(() => {
    if (komaPetting) return 'happy';
    if (currentStepId === 'install-models') {
      if (activeDownloadCount > 0) return 'casting';
      if (hasFailedDownload) return 'surprised';
    }
    return STEP_POSES[currentStepId];
  }, [activeDownloadCount, currentStepId, hasFailedDownload, komaPetting]);

  const petKoma = useCallback(() => {
    setKomaPetting(true);
    if (petTimerRef.current !== null) {
      window.clearTimeout(petTimerRef.current);
    }
    petTimerRef.current = window.setTimeout(() => {
      setKomaPetting(false);
      petTimerRef.current = null;
    }, 1500);
  }, []);

  const goPrev = useCallback(() => {
    setStepIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const goNext = useCallback(() => {
    setStepIndex((prev) => Math.min(ONBOARDING_STEPS.length - 1, prev + 1));
  }, []);

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
          goNext();
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          goPrev();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goNext, goPrev, handleDismiss, open]);

  return {
    stepIndex,
    setStepIndex,
    goPrev,
    goNext,
    currentStep,
    currentStepId,
    isFirst: stepIndex === 0,
    isLast: stepIndex === ONBOARDING_STEPS.length - 1,
    progressPercent: Math.round(((stepIndex + 1) / ONBOARDING_STEPS.length) * 100),
    activeDownloadCount,
    komaPose,
    petKoma,
    komaPetting,
    githubUrl,
    closeButtonRef,
    handleDismiss,
    handleCompleteOnly,
    handleCompleteAndTour,
    handleOpenSettingsFromStep,
  };
}
