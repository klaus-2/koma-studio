/**
 * Renderer console capture for the desktop session log.
 *
 * Forwards console.error + console.warn to a shell-provided session-log sink
 * (Electron: window.desktop.sessionLog; Tauri: the tauri api adapter). All
 * other console levels are untouched. Guards:
 *  - re-entrancy: the sink path may echo into the webview console; while the
 *    sink runs, further capture is skipped (prevents an infinite loop);
 *  - rate ceiling: past ~5 messages/second, messages are suppressed until a
 *    quiet window rollover, and the dropped count is aggregated into ONE
 *    summary entry emitted through the sink.
 * The capture path NEVER logs itself — the one sanctioned silent swallow in
 * the codebase lives in `deliver` below.
 */

export interface SessionLogEntry {
  level: "error" | "warn";
  source: string;
  message: string;
}

export type SessionLogSink = (entry: SessionLogEntry) => void | Promise<void>;

export interface RendererConsoleCaptureOptions {
  /** Shell identifier recorded on every entry (e.g. "electron-renderer"). */
  source: string;
  /** Session-log channel of the running shell. */
  sink: SessionLogSink;
}

export interface RendererConsoleCapture {
  /** Restores the original console methods (used by tests). */
  dispose: () => void;
}

const RATE_WINDOW_MS = 1_000;
const MAX_MESSAGES_PER_WINDOW = 5;

const formatArg = (arg: unknown): string => {
  if (typeof arg === "string") {
    return arg;
  }
  try {
    return JSON.stringify(arg) ?? String(arg);
  } catch {
    return String(arg);
  }
};

export function installRendererConsoleCapture(
  options: RendererConsoleCaptureOptions,
): RendererConsoleCapture {
  const { source, sink } = options;
  const originalError = console.error.bind(console);
  const originalWarn = console.warn.bind(console);

  let inSink = false;
  let windowStart = 0;
  let sentInWindow = 0;
  let droppedInWindow = 0;

  const deliver = (level: "error" | "warn", args: unknown[]): void => {
    inSink = true;
    try {
      void sink({
        level,
        source,
        message: args.map(formatArg).filter((part) => part.length > 0).join(" "),
      });
    } catch {
      // Sanctioned silent swallow: the capture path must never log (it would
      // recurse through this very patch) nor throw into the console patch.
    } finally {
      inSink = false;
    }
  };

  const flushDropped = (level: "error" | "warn"): void => {
    if (droppedInWindow === 0) {
      return;
    }
    const dropped = droppedInWindow;
    droppedInWindow = 0;
    deliver(level, [
      `${dropped} console message(s) suppressed by the session-log rate limiter`,
    ]);
  };

  const emit = (level: "error" | "warn", args: unknown[]): void => {
    if (inSink) {
      return;
    }

    const now = Date.now();
    if (now - windowStart >= RATE_WINDOW_MS) {
      // Quiet period: the window rolled over, so report what was suppressed.
      flushDropped(level);
      windowStart = now;
      sentInWindow = 0;
    }

    if (sentInWindow < MAX_MESSAGES_PER_WINDOW) {
      sentInWindow += 1;
      deliver(level, args);
      return;
    }
    droppedInWindow += 1;
  };

  console.error = (...args: unknown[]): void => {
    originalError(...args);
    emit("error", args);
  };
  console.warn = (...args: unknown[]): void => {
    originalWarn(...args);
    emit("warn", args);
  };

  return {
    dispose: (): void => {
      console.error = originalError;
      console.warn = originalWarn;
    },
  };
}
