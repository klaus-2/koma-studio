import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDashboardProcessingStats } from "./useDashboardProcessingStats";

const STORAGE_KEY = "koma:dashboard-processing-stats:probe-user";

const storageMap = new Map<string, string>();
const localStorageStub = {
  getItem: (key: string): string | null => storageMap.get(key) ?? null,
  setItem: (key: string, value: string): void => {
    storageMap.set(key, value);
  },
  removeItem: (key: string): void => {
    storageMap.delete(key);
  },
  clear: (): void => {
    storageMap.clear();
  },
};
Object.defineProperty(window, "localStorage", {
  value: localStorageStub,
  configurable: true,
});

const pad = (n: number): string => String(n).padStart(2, "0");

const periodKeys = (now: Date): { dayKey: string; weekKey: string; monthKey: string } => {
  const dayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  const daysFromMonday = (weekStart.getDay() + 6) % 7;
  weekStart.setDate(weekStart.getDate() - daysFromMonday);
  const weekKey = `${weekStart.getFullYear()}-${pad(weekStart.getMonth() + 1)}-${pad(weekStart.getDate())}`;
  const monthKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  return { dayKey, weekKey, monthKey };
};

describe("useDashboardProcessingStats (FPS-3 tick guard)", () => {
  beforeEach(() => {
    storageMap.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    storageMap.clear();
  });

  it("keeps stats identity across a same-minute tick and rebuilds it on a minute boundary", () => {

    vi.setSystemTime(new Date("2026-06-15T10:07:25Z"));

    const { result } = renderHook(() => useDashboardProcessingStats(null));
    const initial = result.current.processingStats;

    // Tick 1 (T+5s): same minute → identity must be preserved.
    act(() => {
      vi.advanceTimersByTime(6_000);
    });
    expect(result.current.processingStats).toBe(initial);

    // Tick 2 (T+35s): minute boundary crossed → the summary rebuilds with a
    // fresh countdown (the sidebar's minute-granular display changes).
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(result.current.processingStats).not.toBe(initial);
    expect(result.current.processingStats.daily.count).toBe(initial.daily.count);
    expect(result.current.processingStats.daily.resetInMs).not.toBe(initial.daily.resetInMs);
  });

  it("emits a new summary when the stored counts genuinely change (userKey ingestion)", () => {
    const keys = periodKeys(new Date());
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...keys, dayCount: 3, weekCount: 3, monthCount: 3 }),
    );

    const { result, rerender } = renderHook(
      ({ userKey }) => useDashboardProcessingStats(userKey),
      { initialProps: { userKey: "other-user" as string | null } },
    );
    const before = result.current.processingStats;
    expect(before.daily.count).toBe(0);

    rerender({ userKey: "probe-user" });
    expect(result.current.processingStats).not.toBe(before);
    expect(result.current.processingStats.daily.count).toBe(3);
    expect(result.current.processingStats.weekly.count).toBe(3);
    expect(result.current.processingStats.monthly.count).toBe(3);
  });

  it("recordProcessedPages increments counts and persists them", () => {
    const { result } = renderHook(() => useDashboardProcessingStats("probe-user"));
    const before = result.current.processingStats;

    act(() => {
      result.current.recordProcessedPages(2);
    });

    expect(result.current.processingStats).not.toBe(before);
    expect(result.current.processingStats.daily.count).toBe(before.daily.count + 2);

    const stored = window.localStorage.getItem(STORAGE_KEY);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!).dayCount).toBe(before.daily.count + 2);
  });

  it("ignores non-positive or non-finite page counts", () => {
    const { result } = renderHook(() => useDashboardProcessingStats("probe-user"));
    const before = result.current.processingStats;

    act(() => {
      result.current.recordProcessedPages(0);
      result.current.recordProcessedPages(-1);
      result.current.recordProcessedPages(Number.NaN);
    });

    expect(result.current.processingStats).toBe(before);
  });
});
