import { ONBOARDING_STEPS, type OnboardingStepId } from './onboardingSteps';

export type OnboardingStatus = 'completed' | 'dismissed';

export interface OnboardingStateV1 {
  version: string;
  status: OnboardingStatus;
  lastStepId: OnboardingStepId;
  updatedAt: string;
}

export const ONBOARDING_STORAGE_PREFIX = 'koma-studio.onboarding.v1';
export const ONBOARDING_CONTENT_VERSION = '2026-11-onboarding-v1';
export const ONBOARDING_REOPEN_SESSION_KEY = 'koma-studio.onboarding.reopen-requested';
export const TOUR_REPLAY_SESSION_KEY = 'koma-studio.tour.replay-requested';

const VALID_STEP_IDS = new Set<string>(ONBOARDING_STEPS.map((step) => step.id));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isOnboardingStepId = (value: unknown): value is OnboardingStepId =>
  typeof value === 'string' && VALID_STEP_IDS.has(value);

const normalizeUserScope = (userId: string | null | undefined): string => {
  const trimmed = typeof userId === 'string' ? userId.trim() : '';
  return trimmed.length > 0 ? trimmed : 'guest';
};

const buildStorageKey = (userId: string | null | undefined): string =>
  `${ONBOARDING_STORAGE_PREFIX}:${encodeURIComponent(normalizeUserScope(userId))}`;

export const readOnboardingState = (
  userId: string | null | undefined,
): OnboardingStateV1 | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(buildStorageKey(userId));
    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return null;
    }

    if (
      parsed.version !== ONBOARDING_CONTENT_VERSION ||
      (parsed.status !== 'completed' && parsed.status !== 'dismissed') ||
      !isOnboardingStepId(parsed.lastStepId) ||
      typeof parsed.updatedAt !== 'string'
    ) {
      return null;
    }

    return {
      version: parsed.version,
      status: parsed.status,
      lastStepId: parsed.lastStepId,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
};

export const writeOnboardingState = (
  userId: string | null | undefined,
  status: OnboardingStatus,
  lastStepId: OnboardingStepId,
): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const payload: OnboardingStateV1 = {
      version: ONBOARDING_CONTENT_VERSION,
      status,
      lastStepId,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(buildStorageKey(userId), JSON.stringify(payload));
  } catch {
    return;
  }
};

export const clearOnboardingState = (userId: string | null | undefined): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(buildStorageKey(userId));
  } catch {
    return;
  }
};

export const shouldAutoOpenOnboarding = (
  userId: string | null | undefined,
  hasCompletedTour: boolean,
): boolean => {
  if (typeof window === 'undefined' || !userId || !userId.trim()) {
    return false;
  }
  return readOnboardingState(userId) === null && !hasCompletedTour;
};

export const requestOpenOnboardingOnDashboard = (): void => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.sessionStorage.setItem(ONBOARDING_REOPEN_SESSION_KEY, '1');
  } catch {
    return;
  }
};

export const consumeOpenOnboardingRequest = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    const requested = window.sessionStorage.getItem(ONBOARDING_REOPEN_SESSION_KEY) === '1';
    window.sessionStorage.removeItem(ONBOARDING_REOPEN_SESSION_KEY);
    return requested;
  } catch {
    return false;
  }
};

export const requestReplayTourOnDashboard = (): void => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.sessionStorage.setItem(TOUR_REPLAY_SESSION_KEY, '1');
  } catch {
    return;
  }
};

export const consumeReplayTourRequest = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    const requested = window.sessionStorage.getItem(TOUR_REPLAY_SESSION_KEY) === '1';
    window.sessionStorage.removeItem(TOUR_REPLAY_SESSION_KEY);
    return requested;
  } catch {
    return false;
  }
};
