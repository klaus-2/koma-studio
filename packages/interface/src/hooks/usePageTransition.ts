import { useCallback, useEffect, useRef, useState } from "react";

interface UsePageTransitionOptions {
  minDuration?: number;
}

interface UsePageTransitionReturn {
  isActive: boolean;
  message: string;
  start: (msg?: string) => void;
  end: () => void;
  setMessage: (msg: string) => void;
  wrap: <T>(operation: () => Promise<T>, msg?: string) => Promise<T>;
  runNavigation: (update: () => void, msg?: string) => void;
}

export const usePageTransition = (
  options: UsePageTransitionOptions = {},
): UsePageTransitionReturn => {
  const { minDuration = 600 } = options;
  const [isActive, setIsActive] = useState(false);
  const [message, setMessage] = useState("");

  const startTimeRef = useRef(0);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefersReducedMotionRef = useRef(false);

  const clearHideTimeout = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      clearHideTimeout();
    },
    [clearHideTimeout],
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => {
      prefersReducedMotionRef.current = mediaQuery.matches;
    };

    updatePreference();

    mediaQuery.addEventListener?.("change", updatePreference);
    return () => {
      mediaQuery.removeEventListener?.("change", updatePreference);
    };
  }, []);

  const start = useCallback(
    (msg?: string) => {
      clearHideTimeout();
      setMessage(msg ?? "");
      setIsActive(true);
      startTimeRef.current = Date.now();
    },
    [clearHideTimeout],
  );

  const end = useCallback(() => {
    const elapsed = Date.now() - startTimeRef.current;
    const remaining = Math.max(0, minDuration - elapsed);

    clearHideTimeout();
    if (remaining > 0) {
      hideTimeoutRef.current = setTimeout(() => {
        setIsActive(false);
        hideTimeoutRef.current = null;
      }, remaining);
      return;
    }

    setIsActive(false);
  }, [clearHideTimeout, minDuration]);

  const wrap = useCallback(
    async <T,>(operation: () => Promise<T>, msg?: string): Promise<T> => {
      start(msg);
      try {
        return await operation();
      } finally {
        end();
      }
    },
    [start, end],
  );

  const runNavigation = useCallback(
    (update: () => void, msg?: string) => {
      const canUseNativeTransition =
        typeof document !== "undefined" &&
        typeof document.startViewTransition === "function" &&
        !prefersReducedMotionRef.current;

      if (!canUseNativeTransition) {
        start(msg);
        update();

        window.requestAnimationFrame(() => {
          end();
        });
        return;
      }

      clearHideTimeout();
      setIsActive(false);
      setMessage(msg ?? "");

      try {
        const startViewTransition = document.startViewTransition;
        if (!startViewTransition) {
          throw new Error("Native view transitions are unavailable");
        }

        const transition = startViewTransition(() => {
          update();
        });

        void transition.finished.catch(() => {
          // Ignore transition cancellation; DOM updates already committed.
        });
      } catch {
        start(msg);
        update();

        window.requestAnimationFrame(() => {
          end();
        });
      }
    },
    [clearHideTimeout, end, start],
  );

  return { isActive, message, start, end, setMessage, wrap, runNavigation };
};
