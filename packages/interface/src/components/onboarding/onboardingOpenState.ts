import { useSyncExternalStore } from 'react';

let onboardingOpenCount = 0;
const listeners = new Set<() => void>();

const emit = () => {
  for (const listener of listeners) {
    listener();
  }
};

export const acquireOnboardingModalLock = (): (() => void) => {
  onboardingOpenCount += 1;
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    onboardingOpenCount = Math.max(0, onboardingOpenCount - 1);
    emit();
  };
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = (): boolean => onboardingOpenCount > 0;

export const useIsOnboardingModalOpen = (): boolean =>
  useSyncExternalStore(subscribe, getSnapshot, () => false);
