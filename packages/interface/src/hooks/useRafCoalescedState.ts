import { useCallback, useEffect, useRef, useState } from "react";

/**
 * State whose updates coalesce to at most one re-render per animation frame:
 * rapid callers (pointermove, range input) overwrite a pending value and the
 * consumer sees only the last one. `setNow` bypasses the gate for resets and
 * cancels any frame still queued, so a stale value can never land after it.
 */
export const useRafCoalescedState = <T>(initial: T) => {
  const [value, setValue] = useState<T>(initial);
  const rafRef = useRef(0);
  const pendingRef = useRef<T>(initial);

  const flush = useCallback(() => {
    rafRef.current = 0;
    setValue(pendingRef.current);
  }, []);

  const schedule = useCallback(
    (next: T) => {
      pendingRef.current = next;
      if (rafRef.current === 0) {
        rafRef.current = window.requestAnimationFrame(flush);
      }
    },
    [flush],
  );

  const setNow = useCallback((next: T) => {
    if (rafRef.current !== 0) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    pendingRef.current = next;
    setValue(next);
  }, []);

  useEffect(
    () => () => {
      if (rafRef.current !== 0) {
        window.cancelAnimationFrame(rafRef.current);
      }
    },
    [],
  );

  return { value, schedule, setNow } as const;
};
