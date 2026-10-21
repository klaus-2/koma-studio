import { useEffect, useMemo } from 'react';

import {
  bindUserKey,
  buildProcessingStatsSummary,
  recordProcessedPages as recordProcessedPagesAction,
  useProcessingStatsStore,
} from '../pages/dashboard/stores/processing-stats-store';

export { recordProcessedPages } from '../pages/dashboard/stores/processing-stats-store';

/**
 * Processing stats for the dashboard (day/week/month counters).
 *
 * The 30s clock lives in `useProcessingStatsStore` and is mounted only while
 * this hook is subscribed (sidebar leaf). Page orchestrators should call the
 * exported `recordProcessedPages` so they do not re-render on countdown ticks.
 */
export const useDashboardProcessingStats = (userKey: string | null) => {
  const nowMs = useProcessingStatsStore((s) => s.nowMs);
  const stats = useProcessingStatsStore((s) => s.stats);

  useEffect(() => {
    bindUserKey(userKey);
  }, [userKey]);

  useEffect(() => {
    let intervalId: number | null = null;
    const alignmentDelay = 30_000 - (Date.now() % 30_000 || 30_000);
    const timeoutId = window.setTimeout(() => {
      useProcessingStatsStore.getState().tick();
      intervalId = window.setInterval(
        () => useProcessingStatsStore.getState().tick(),
        30_000,
      );
    }, alignmentDelay);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [userKey]);

  const processingStats = useMemo(
    () => buildProcessingStatsSummary(nowMs, stats),
    [nowMs, stats],
  );

  return {
    processingStats,
    recordProcessedPages: recordProcessedPagesAction,
  };
};
