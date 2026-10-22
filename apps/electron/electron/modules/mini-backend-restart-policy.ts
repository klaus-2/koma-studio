/**
 * Pure restart policy for the Electron mini-backend supervisor.
 *
 * The stop predicate is shared verbatim with the Tauri supervisor in
 * `apps/tauri/src-tauri/src/sidecar/recovery.rs`:
 *   (a) three pre-health non-zero exits within a rolling 120 s window; or
 *   (b) five restart attempts that failed overall.
 * Counters survive restart episodes and reset only after a confirmed `/health`
 * plus 60 s of healthy runtime. A spawn error or a missing runtime is a
 * one-shot stop and never retries.
 *
 * No timers and no process state live here: time arrives through `now`, so the
 * policy is deterministic under a fake clock and can be unit-tested alone.
 */

export const MINI_BACKEND_RESTART_BASE_DELAY_MS = 250;
export const MINI_BACKEND_RESTART_MAX_DELAY_MS = 30_000;
export const MINI_BACKEND_RESTART_MAX_ATTEMPTS = 5;
export const MINI_BACKEND_HEALTHY_RESET_MS = 60_000;
export const MINI_BACKEND_PRE_HEALTH_WINDOW_MS = 120_000;
export const MINI_BACKEND_PRE_HEALTH_EXIT_LIMIT = 3;
export const MINI_BACKEND_CRASH_STDERR_MAX_LINES = 50;
export const MINI_BACKEND_CRASH_STDERR_MAX_CHARS = 2_000;

export type MiniBackendRestartStopReason =
  | "crash-loop"
  | "attempt-limit"
  | "spawn-error"
  | "missing-runtime";

export type MiniBackendRestartReason = "retry" | "health-timeout" | MiniBackendRestartStopReason;

export interface MiniBackendRestartDecision {
  action: "restart" | "stop";
  /** 1-based restart attempt this decision refers to. */
  attempt: number;
  /** Backoff before the restart; 0 when the decision is to stop. */
  delayMs: number;
  reason: MiniBackendRestartReason;
}

export interface MiniBackendUnexpectedExit {
  exitCode: number | null;
  /** Whether the child that just exited had confirmed `/health` at least once. */
  healthConfirmed: boolean;
}

export interface MiniBackendRestartPolicyDeps {
  now: () => number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  maxAttempts?: number;
  healthyResetMs?: number;
  preHealthExitWindowMs?: number;
  preHealthExitLimit?: number;
}

export interface MiniBackendRestartPolicy {
  /** Record a confirmed `/health` response for the current child. */
  noteHealthy: () => void;
  recordUnexpectedExit: (input: MiniBackendUnexpectedExit) => MiniBackendRestartDecision;
  recordHealthTimeout: () => MiniBackendRestartDecision;
  recordSpawnFailure: (reason: "spawn-error" | "missing-runtime") => MiniBackendRestartDecision;
  getAttempt: () => number;
  getMaxAttempts: () => number;
}

/**
 * Error thrown by the spawn path when a restart spawned a child that never
 * reached `/health`. The supervisor retries these with backoff; every other
 * rejection (spawn error, missing runtime) is a one-shot stop.
 */
export type MiniBackendRestartFailureKind = "health-timeout";

export class MiniBackendRestartError extends Error {
  readonly kind: MiniBackendRestartFailureKind;

  constructor(kind: MiniBackendRestartFailureKind, message: string) {
    super(message);
    this.name = "MiniBackendRestartError";
    this.kind = kind;
  }
}

const createMiniBackendRestartPolicy = (
  deps: MiniBackendRestartPolicyDeps,
): MiniBackendRestartPolicy => {
  const baseDelayMs = deps.baseDelayMs ?? MINI_BACKEND_RESTART_BASE_DELAY_MS;
  const maxDelayMs = deps.maxDelayMs ?? MINI_BACKEND_RESTART_MAX_DELAY_MS;
  const maxAttempts = deps.maxAttempts ?? MINI_BACKEND_RESTART_MAX_ATTEMPTS;
  const healthyResetMs = deps.healthyResetMs ?? MINI_BACKEND_HEALTHY_RESET_MS;
  const preHealthExitWindowMs =
    deps.preHealthExitWindowMs ?? MINI_BACKEND_PRE_HEALTH_WINDOW_MS;
  const preHealthExitLimit = deps.preHealthExitLimit ?? MINI_BACKEND_PRE_HEALTH_EXIT_LIMIT;

  let attempts = 0;
  let healthyAt: number | null = null;
  let preHealthExitTimes: number[] = [];

  const noteHealthy = (): void => {
    healthyAt = deps.now();
  };

  const resetCounters = (): void => {
    attempts = 0;
    preHealthExitTimes = [];
  };

  const nextRestartDecision = (): MiniBackendRestartDecision => {
    attempts += 1;
    if (attempts > maxAttempts) {
      return { action: "stop", attempt: attempts, delayMs: 0, reason: "attempt-limit" };
    }
    const delayMs = Math.min(baseDelayMs * 2 ** (attempts - 1), maxDelayMs);
    return { action: "restart", attempt: attempts, delayMs, reason: "retry" };
  };

  const recordUnexpectedExit = (
    input: MiniBackendUnexpectedExit,
  ): MiniBackendRestartDecision => {
    const now = deps.now();
    if (input.healthConfirmed && healthyAt !== null && now - healthyAt >= healthyResetMs) {
      resetCounters();
    }
    // The child is gone; a new `/health` is required before this can be
    // considered a healthy runtime again.
    healthyAt = null;

    if (!input.healthConfirmed && input.exitCode !== null && input.exitCode !== 0) {
      preHealthExitTimes.push(now);
      const cutoff = now - preHealthExitWindowMs;
      preHealthExitTimes = preHealthExitTimes.filter((at) => at >= cutoff);
      if (preHealthExitTimes.length >= preHealthExitLimit) {
        return {
          action: "stop",
          attempt: attempts,
          delayMs: 0,
          reason: "crash-loop",
        };
      }
    }

    return nextRestartDecision();
  };

  return {
    noteHealthy,
    recordUnexpectedExit,
    recordHealthTimeout: nextRestartDecision,
    recordSpawnFailure: (reason) => {
      attempts += 1;
      return { action: "stop", attempt: attempts, delayMs: 0, reason };
    },
    getAttempt: () => attempts,
    getMaxAttempts: () => maxAttempts,
  };
};

const SECRET_REDACTION_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/sk-[A-Za-z0-9_-]{3,}/g, "sk-[redacted]"],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]"],
  [/\b(api[_-]?key)\s*[=:]\s*("[^"]*"|'[^']*'|[^\s,;&"']+)/gi, "$1=[redacted]"],
  [/\b(token)\s*[=:]\s*("[^"]*"|'[^']*'|[^\s,;&"']+)/gi, "$1=[redacted]"],
];

/** Remove API keys/tokens from a crash tail before it reaches state or logs. */
export const redactMiniBackendSecrets = (text: string): string =>
  SECRET_REDACTION_RULES.reduce(
    (redacted, [pattern, replacement]) => redacted.replace(pattern, replacement),
    text,
  );

/**
 * Crash post-mortem tail: secrets redacted, last 50 lines, at most 2000 chars.
 */
export const formatMiniBackendCrashStderr = (raw: string): string => {
  const trimmed = raw.replace(/\r\n/g, "\n").trim();
  if (trimmed === "") {
    return "";
  }
  const lines = redactMiniBackendSecrets(trimmed).split("\n");
  const tail = lines.slice(-MINI_BACKEND_CRASH_STDERR_MAX_LINES).join("\n");
  return tail.length > MINI_BACKEND_CRASH_STDERR_MAX_CHARS
    ? tail.slice(-MINI_BACKEND_CRASH_STDERR_MAX_CHARS)
    : tail;
};

export { createMiniBackendRestartPolicy };
