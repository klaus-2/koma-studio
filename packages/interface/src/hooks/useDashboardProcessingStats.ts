import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { DashboardProcessingStatsSummary } from '../types/dashboard.types';

interface DashboardProcessingStatsState {
  dayKey: string;
  weekKey: string;
  monthKey: string;
  dayCount: number;
  weekCount: number;
  monthCount: number;
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

const createEmptyState = (now: Date): DashboardProcessingStatsState => {
  const keys = getPeriodKeys(now);
  return {
    ...keys,
    dayCount: 0,
    weekCount: 0,
    monthCount: 0,
  };
};

const normalizeState = (state: DashboardProcessingStatsState, now: Date): DashboardProcessingStatsState => {
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

const persistState = (userKey: string | null, state: DashboardProcessingStatsState): void => {
  if (!userKey || typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(`${STORAGE_KEY_PREFIX}${userKey}`, JSON.stringify(state));
};

const readStoredState = (userKey: string | null, now: Date): DashboardProcessingStatsState => {
  if (!userKey || typeof window === 'undefined') {
    return createEmptyState(now);
  }
  const raw = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${userKey}`);
  if (!raw) {
    return createEmptyState(now);
  }
  try {
    const parsed = JSON.parse(raw) as Partial<DashboardProcessingStatsState>;
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

export const useDashboardProcessingStats = (userKey: string | null) => {
  const [state, setState] = useState<DashboardProcessingStatsState>(() => {
    const now = new Date();
    return normalizeState(readStoredState(userKey, now), now);
  });

  const [now, setNow] = useState(() => Date.now());
  const lastMinuteRef = useRef(Math.floor(now / 60_000));

  useEffect(() => {
    const current = new Date();
    const normalized = normalizeState(readStoredState(userKey, current), current);

    setState((previous) =>
      previous.dayKey === normalized.dayKey &&
        previous.weekKey === normalized.weekKey &&
        previous.monthKey === normalized.monthKey &&
        previous.dayCount === normalized.dayCount &&
        previous.weekCount === normalized.weekCount &&
        previous.monthCount === normalized.monthCount
        ? previous
        : normalized,
    );
    persistState(userKey, normalized);
  }, [userKey]);

  useEffect(() => {
    let intervalId: number | null = null;
    let timeoutId: number | null = null;

    const tick = () => {
      const current = new Date();

      const minuteSignature = Math.floor(current.getTime() / 60_000);
      if (minuteSignature === lastMinuteRef.current) {
        return;
      }
      lastMinuteRef.current = minuteSignature;
      setNow(current.getTime());
      setState((previous) => {
        const normalized = normalizeState(previous, current);
        if (
          normalized.dayKey === previous.dayKey &&
          normalized.weekKey === previous.weekKey &&
          normalized.monthKey === previous.monthKey
        ) {
          return previous;
        }
        persistState(userKey, normalized);
        return normalized;
      });
    };

    const alignmentDelay = 30_000 - (Date.now() % 30_000 || 30_000);
    timeoutId = window.setTimeout(() => {
      tick();
      intervalId = window.setInterval(tick, 30_000);
    }, alignmentDelay);

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [userKey]);

  const recordProcessedPages = useCallback((pages: number) => {
    if (!Number.isFinite(pages) || pages <= 0) {
      return;
    }

    const current = new Date();
    setNow(current.getTime());
    lastMinuteRef.current = Math.floor(current.getTime() / 60_000);
    setState((previous) => {
      const normalized = normalizeState(previous, current);
      const nextState = {
        ...normalized,
        dayCount: normalized.dayCount + pages,
        weekCount: normalized.weekCount + pages,
        monthCount: normalized.monthCount + pages,
      };
      persistState(userKey, nextState);
      return nextState;
    });
  }, [userKey]);

  const processingStats = useMemo<DashboardProcessingStatsSummary>(() => {
    const current = new Date(now);
    const normalized = normalizeState(state, current);
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
  }, [now, state]);

  return {
    processingStats,
    recordProcessedPages,
  };
};
