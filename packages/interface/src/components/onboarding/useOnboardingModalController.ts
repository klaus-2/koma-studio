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
import {
  areAllMissionsComplete,
  countCompletedMissions,
  createInitialCompletion,
  type InteractiveMissionId,
  type InteractiveToolsCompletion,
} from './interactive-tools/InteractiveToolsTypes';
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
  isReviewing?: boolean;
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

const TOOLS_STEP_INDEX = ONBOARDING_STEPS.findIndex((step) => step.id === 'tools-healing');

export interface OnboardingController {
  stepIndex: number;
  setStepIndex: (index: number) => void;
  goPrev: () => void;
  goNext: () => void;
  currentStep: OnboardingStepMeta;
  currentStepId: OnboardingStepId;
  isFirst: boolean;
  isLast: boolean;
  isNextLocked: boolean;
  toolsCompletion: InteractiveToolsCompletion;
  toolsCompletedCount: number;
  toolsComplete: boolean;
  completeToolsMission: (mission: InteractiveMissionId) => void;
  progressPercent: number;
  activeDownloadCount: number;
  komaPose: KomaPose;
  petKoma: () => void;
  komaPetting: boolean;
  githubUrl: string;
  canDismiss: boolean;
  goToStep: (stepId: OnboardingStepId) => void;
  handleDismiss: () => void;
  handleCompleteOnly: () => void;
  handleCompleteAndTour: () => void;
  handleOpenSettingsFromStep: (tab: SettingsTab) => void;
}

export function useOnboardingModalController({
  open,
  isReviewing = false,
  userId = null,
  githubUrl = KOMA_GITHUB_REPO_URL,
  onClose,
  onStartTour,
  onOpenSettingsTab,
}: OnboardingModalProps): OnboardingController {
  const canDismiss = isReviewing;
  const [stepIndex, setStepIndexState] = useState(0);
  const [toolsCompletion, setToolsCompletion] = useState<InteractiveToolsCompletion>(() =>
    createInitialCompletion(false),
  );
  const [komaPetting, setKomaPetting] = useState(false);
  const petTimerRef = useRef<number | null>(null);
  const { entries } = useModelManagerLiveState();

  useEffect(() => {
    if (!open) {
      return;
    }
    const releaseLock = acquireOnboardingModalLock();
    setStepIndexState(0);
    setToolsCompletion(createInitialCompletion(false));
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

  const toolsCompletedCount = countCompletedMissions(toolsCompletion);
  const toolsComplete = areAllMissionsComplete(toolsCompletion);
  const isNextLocked = !canDismiss && currentStepId === 'tools-healing' && !toolsComplete;

  const completeToolsMission = useCallback((mission: InteractiveMissionId) => {
    setToolsCompletion((prev) => (prev[mission] ? prev : { ...prev, [mission]: true }));
  }, []);

  const setStepIndex = useCallback(
    (nextIndex: number) => {
      const bounded = Math.max(0, Math.min(ONBOARDING_STEPS.length - 1, nextIndex));
      if (!canDismiss && !toolsComplete && bounded > TOOLS_STEP_INDEX) {
        return;
      }
      setStepIndexState(bounded);
    },
    [canDismiss, toolsComplete],
  );

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
    setStepIndexState((prev) => Math.max(0, prev - 1));
  }, []);

  const goToStep = useCallback(
    (stepId: OnboardingStepId) => {
      const index = ONBOARDING_STEPS.findIndex((step) => step.id === stepId);
      if (index >= 0) {
        setStepIndex(index);
      }
    },
    [setStepIndex],
  );

  const goNext = useCallback(() => {
    setStepIndexState((prev) => {
      const next = Math.min(ONBOARDING_STEPS.length - 1, prev + 1);
      if (!canDismiss && !toolsComplete && next > TOOLS_STEP_INDEX) {
        return prev;
      }
      return next;
    });
  }, [canDismiss, toolsComplete]);

  const handleDismiss = useCallback(() => {
    if (!canDismiss) return;
    writeOnboardingState(userId, 'dismissed', currentStepId);
    onClose();
  }, [canDismiss, currentStepId, onClose, userId]);

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
      const owner = event.target instanceof Element ? event.target.closest('[role="dialog"]') : null;
      if (event.defaultPrevented || (owner && !owner.hasAttribute('data-onboarding-theme'))) {
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        if (canDismiss) {
          handleDismiss();
        }
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
  }, [canDismiss, goNext, goPrev, handleDismiss, open]);

  return {
    stepIndex,
    setStepIndex,
    goPrev,
    goNext,
    currentStep,
    currentStepId,
    isFirst: stepIndex === 0,
    isLast: stepIndex === ONBOARDING_STEPS.length - 1,
    isNextLocked,
    toolsCompletion,
    toolsCompletedCount,
    toolsComplete,
    completeToolsMission,
    progressPercent: Math.round(((stepIndex + 1) / ONBOARDING_STEPS.length) * 100),
    activeDownloadCount,
    komaPose,
    petKoma,
    komaPetting,
    githubUrl,
    canDismiss,
    goToStep,
    handleDismiss,
    handleCompleteOnly,
    handleCompleteAndTour,
    handleOpenSettingsFromStep,
  };
}
