import { useCallback, useEffect, useMemo, useState } from "react";
import { useIdleTimer, type IIdleTimerProps } from "react-idle-timer";

interface SessionOptions {
  enabled: boolean;
  timeoutMs?: number;
  warningMs?: number;
  onTimeout: () => void;
  onActivity?: () => void;
}

interface SessionState {
  secondsLeft: number;
  isWarning: boolean;
  stayActive: () => void;
}

const SESSION_ACTIVITY_EVENTS = [
  "mousemove",
  "keydown",
  "wheel",
  "scroll",
  "mousedown",
  "click",
  "keyup",
  "touchstart",
  "touchmove",
  "touchend",
  "visibilitychange",
  "focus",
  "pointerdown",
  "pointermove",
  "pointerup",
  "input",
] as const;

export const useSession = ({
  enabled,
  timeoutMs = 15 * 60 * 1000,
  warningMs = 60 * 1000,
  onTimeout,
  onActivity,
}: SessionOptions): SessionState => {
  const [secondsLeft, setSecondsLeft] = useState<number>(Math.ceil(warningMs / 1_000));
  const [isWarning, setIsWarning] = useState(false);

  const syncRemainingTime = useCallback((remainingMs: number) => {
    setSecondsLeft(Math.max(0, Math.ceil(remainingMs / 1_000)));
  }, []);

  const handlePrompt = useCallback(() => {
    setIsWarning(true);
  }, []);

  const handleIdle = useCallback(() => {
    setIsWarning(false);
    setSecondsLeft(0);
    onTimeout();
  }, [onTimeout]);

  const handleActive = useCallback(() => {
    setIsWarning(false);
    setSecondsLeft(Math.ceil(warningMs / 1_000));
  }, [warningMs]);

  const notifyActivity = useCallback(() => {
    onActivity?.();
  }, [onActivity]);

  const { activate, getRemainingTime, isPrompted, pause, reset } = useIdleTimer({
    timeout: timeoutMs,
    promptBeforeIdle: warningMs,
    startOnMount: false,
    eventsThrottle: 200,
    events: SESSION_ACTIVITY_EVENTS as unknown as IIdleTimerProps["events"],
    onPrompt: (_event, idleTimer) => {
      handlePrompt();
      syncRemainingTime(idleTimer?.getRemainingTime() ?? getRemainingTime());
    },
    onIdle: handleIdle,
    onActive: (_event, idleTimer) => {
      handleActive();
      notifyActivity();
      syncRemainingTime(idleTimer?.getRemainingTime() ?? getRemainingTime());
    },
    onAction: (_event, idleTimer) => {
      notifyActivity();
      if (idleTimer?.isPrompted()) {
        idleTimer.activate();
        return;
      }

      if (isWarning) {
        syncRemainingTime(idleTimer?.getRemainingTime() ?? getRemainingTime());
      }
    },
  });

  useEffect(() => {
    if (!enabled) {
      pause();
      setIsWarning(false);
      setSecondsLeft(Math.ceil(warningMs / 1_000));
      return;
    }

    reset();
    activate();
    setIsWarning(false);
    syncRemainingTime(timeoutMs);
  }, [activate, enabled, pause, reset, syncRemainingTime, timeoutMs, warningMs]);

  useEffect(() => {
    if (!enabled || !isPrompted()) {
      return;
    }

    syncRemainingTime(getRemainingTime());

    const interval = window.setInterval(() => {
      syncRemainingTime(getRemainingTime());
    }, 1_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [enabled, getRemainingTime, isPrompted, isWarning, syncRemainingTime]);

  const stayActive = useCallback(() => {
    activate();
    notifyActivity();
    setIsWarning(false);
    setSecondsLeft(Math.ceil(warningMs / 1_000));
  }, [activate, notifyActivity, warningMs]);

  return useMemo(
    () => ({
      secondsLeft,
      isWarning,
      stayActive,
    }),
    [isWarning, secondsLeft, stayActive],
  );
};
