import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';

import {
  consumeOpenOnboardingRequest,
  consumeReplayTourRequest,
  readOnboardingState,
  shouldAutoOpenOnboarding,
} from '../components/onboarding/onboardingStorage';
import { readDashboardTourState } from './useDashboardTour';

export interface OnboardingState {
  isOpen: boolean;
  suppressAutoTour: boolean;
  shouldAutoOpen: boolean;
  open: () => void;
  close: () => void;
  sessionHandledRef: MutableRefObject<boolean>;
  autoCheckedUserRef: MutableRefObject<string | null>;
}

export const useOnboardingState = (userId: string | null): OnboardingState => {
  const [isOpen, setIsOpen] = useState(false);
  const sessionHandledRef = useRef(false);
  const autoCheckedUserRef = useRef<string | null>(null);

  const hasCompletedMainTour = Boolean(userId && readDashboardTourState(userId));
  const shouldAutoOpen = shouldAutoOpenOnboarding(userId, hasCompletedMainTour);
  const suppressAutoTour = isOpen || readOnboardingState(userId) !== null || shouldAutoOpen;

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    suppressAutoTour,
    shouldAutoOpen,
    open,
    close,
    sessionHandledRef,
    autoCheckedUserRef,
  };
};

interface UseOnboardingSessionArgs {
  userId: string | null;
  isAuthReady: boolean;
  replayTour: () => void;
  onboarding: OnboardingState;
}

export const useOnboardingSession = ({
  userId,
  isAuthReady,
  replayTour,
  onboarding,
}: UseOnboardingSessionArgs) => {
  const { shouldAutoOpen, open, sessionHandledRef, autoCheckedUserRef } = onboarding;

  useEffect(() => {
    if (!isAuthReady || typeof window === 'undefined') {
      return;
    }

    if (!sessionHandledRef.current) {
      sessionHandledRef.current = true;
      if (consumeOpenOnboardingRequest()) {
        open();
        if (userId) {
          autoCheckedUserRef.current = userId;
        }
        return;
      }
      if (consumeReplayTourRequest()) {
        if (userId) {
          autoCheckedUserRef.current = userId;
        }
        window.setTimeout(replayTour, 60);
        return;
      }
    }

    if (!userId) {
      autoCheckedUserRef.current = null;
      return;
    }
    if (autoCheckedUserRef.current === userId) {
      return;
    }
    autoCheckedUserRef.current = userId;
    if (shouldAutoOpen) {
      open();
    }
  }, [autoCheckedUserRef, isAuthReady, open, replayTour, sessionHandledRef, shouldAutoOpen, userId]);
};
