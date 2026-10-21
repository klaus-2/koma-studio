import { create } from 'zustand';

import type { DashboardProcessingStatsSummary } from '@/types/dashboard.types';

/**
 * Processing-stats domain store.
 *
 * Countdown ticks must not re-render DashboardPage. The sidebar leaf mounts
 * the clock; page orchestrators only call recordProcessedPages via getState()
 * (same leaf-isolation pattern as progress/status).
 */
interface ProcessingStatsState {
  dayKey: string;
  weekKey: string;
  monthKey: string;
  dayCount: number;
  weekCount: number;
  monthCount: number;
}

interface ProcessingStatsStore {
  userKey: string | null;
  nowMs: number;
  stats: ProcessingStatsState;
  /** Bind user + hydrate from localStorage (idempotent). */
  bindUserKey: (userKey: string | null) => void;
  recordProcessedPages: (pages: number) => void;
  /** Advance countdown / period rollover (sidebar clock only). */
  tick: () => void;
}

const STORAGE_KEY_PREFIX = 'koma:dashboard-processing-stats:';

const getWeekStart = (now: Date): Date => {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const currentDay = start.getDay();
  const daysFromMonday = (currentDay + 6) % 7;
  start.setDate(start.getDate() - daysFromMonday);
  return start;
};

const getPeriodKeys = (now: Date) => {
  const dayKey = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
  const weekStart = getWeekStart(now);
  const weekKey = [
    weekStart.getFullYear(),
    String(weekStart.getMonth() + 1).padStart(2, '0'),
    String(weekStart.getDate()).padStart(2, '0'),
  ].join('-');
  const monthKey = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
  ].join('-');
  return { dayKey, weekKey, monthKey };
};

const createEmptyState = (now: Date): ProcessingStatsState => {
  const keys = getPeriodKeys(now);
  return {
    ...keys,
    dayCount: 0,
    weekCount: 0,
    monthCount: 0,
  };
};

export const normalizeProcessingStatsState = (
  state: ProcessingStatsState,
  now: Date,
): ProcessingStatsState => {
  const keys = getPeriodKeys(now);
  return {
    dayKey: keys.dayKey,
    weekKey: keys.weekKey,
    monthKey: keys.monthKey,
    dayCount: state.dayKey === keys.dayKey ? state.dayCount : 0,
    weekCount: state.weekKey === keys.weekKey ? state.weekCount : 0,
    monthCount: state.monthKey === keys.monthKey ? state.monthCount : 0,
  };
};

const persistState = (userKey: string | null, state: ProcessingStatsState): void => {
  if (!userKey || typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(`${STORAGE_KEY_PREFIX}${userKey}`, JSON.stringify(state));
};

export const readStoredProcessingStats = (
  userKey: string | null,
  now: Date,
): ProcessingStatsState => {
  if (!userKey || typeof window === 'undefined') {
    return createEmptyState(now);
  }
  const raw = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${userKey}`);
  if (!raw) {
    return createEmptyState(now);
  }
  try {
    const parsed = JSON.parse(raw) as Partial<ProcessingStatsState>;
    return {
      ...createEmptyState(now),
      ...parsed,
    };
  } catch {
    return createEmptyState(now);
  }
};

const getNextDailyReset = (now: Date): Date => {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next;
};

const getNextWeeklyReset = (now: Date): Date => {
  const weekStart = getWeekStart(now);
  const next = new Date(weekStart);
  next.setDate(next.getDate() + 7);
  next.setHours(0, 0, 0, 0);
  return next;
};

const getNextMonthlyReset = (now: Date): Date => {
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  next.setHours(0, 0, 0, 0);
  return next;
};

export const buildProcessingStatsSummary = (
  nowMs: number,
  stats: ProcessingStatsState,
): DashboardProcessingStatsSummary => {
  const current = new Date(nowMs);
  const normalized = normalizeProcessingStatsState(stats, current);
  return {
    daily: {
      key: 'daily',
      count: normalized.dayCount,
      resetInMs: Math.max(0, getNextDailyReset(current).getTime() - current.getTime()),
    },
    weekly: {
      key: 'weekly',
      count: normalized.weekCount,
      resetInMs: Math.max(0, getNextWeeklyReset(current).getTime() - current.getTime()),
    },
    monthly: {
      key: 'monthly',
      count: normalized.monthCount,
      resetInMs: Math.max(0, getNextMonthlyReset(current).getTime() - current.getTime()),
    },
  };
};

const initialNow = Date.now();
/** FPS-3: minute bucket of the last emitted nowMs. */
let lastMinuteBucket = Math.floor(initialNow / 60_000);

export const useProcessingStatsStore = create<ProcessingStatsStore>((set, get) => ({
  userKey: null,
  nowMs: initialNow,
  stats: createEmptyState(new Date(initialNow)),

  bindUserKey: (userKey) => {
    const now = new Date();
    const current = get();
    if (current.userKey === userKey) {
      // Still refresh the clock so the first mount sees Date.now()
      // (fake-timer tests and long-lived modules both depend on this).
      lastMinuteBucket = Math.floor(now.getTime() / 60_000);
      if (current.nowMs !== now.getTime()) {
        set({ nowMs: now.getTime() });
      }
      return;
    }
    const next = normalizeProcessingStatsState(
      readStoredProcessingStats(userKey, now),
      now,
    );
    persistState(userKey, next);
    lastMinuteBucket = Math.floor(now.getTime() / 60_000);
    set({ userKey, nowMs: now.getTime(), stats: next });
  },

  recordProcessedPages: (pages) => {
    if (!Number.isFinite(pages) || pages <= 0) {
      return;
    }
    const current = new Date();
    const { userKey, stats } = get();
    const normalized = normalizeProcessingStatsState(stats, current);
    const nextState = {
      ...normalized,
      dayCount: normalized.dayCount + pages,
      weekCount: normalized.weekCount + pages,
      monthCount: normalized.monthCount + pages,
    };
    persistState(userKey, nextState);
    lastMinuteBucket = Math.floor(current.getTime() / 60_000);
    set({ nowMs: current.getTime(), stats: nextState });
  },

  tick: () => {
    const current = new Date();
    // FPS-3: skip contentless ticks — the countdown is minute-granular.
    const minuteBucket = Math.floor(current.getTime() / 60_000);
    if (minuteBucket === lastMinuteBucket) {
      return;
    }
    lastMinuteBucket = minuteBucket;
    const { userKey, stats } = get();
    const normalized = normalizeProcessingStatsState(stats, current);
    if (
      normalized.dayKey !== stats.dayKey ||
      normalized.weekKey !== stats.weekKey ||
      normalized.monthKey !== stats.monthKey
    ) {
      persistState(userKey, normalized);
    }
    set({ nowMs: current.getTime(), stats: normalized });
  },
}));

/** Imperative API for page orchestrators (no React subscription). */
export const recordProcessedPages = (pages: number): void => {
  useProcessingStatsStore.getState().recordProcessedPages(pages);
};

/** Imperative bind/hydrate (no React subscription). */
export const bindUserKey = (userKey: string | null): void => {
  useProcessingStatsStore.getState().bindUserKey(userKey);
};
