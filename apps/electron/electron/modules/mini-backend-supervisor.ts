/**
 * Mini-backend child-process supervisor: spawn registration, log-stream
 * wiring, the legacy CPU-fallback log-marker parser, graceful-stop
 * sequencing, crash reporting and bounded automatic recovery.
 * Pure node — no electron imports — unit-testable under node:test.
 */
import { execFileSync, type ChildProcess } from "node:child_process";

import { formatRuntimeFallbackReason } from "../mini-backend-runtime.ts";
import {
  MINI_BACKEND_CRASH_STDERR_MAX_CHARS,
  MiniBackendRestartError,
  createMiniBackendRestartPolicy,
  formatMiniBackendCrashStderr,
  redactMiniBackendSecrets,
  type MiniBackendRestartDecision,
} from "./mini-backend-restart-policy.ts";
import type { MiniBackendRuntimeState } from "./mini-backend-runtime-store.ts";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const waitForMiniBackendProcessExit = async (
  exitPromise: Promise<void> | null,
  timeoutMs: number,
): Promise<boolean> => {
  if (!exitPromise) {
    return true;
  }

  try {
    return await Promise.race([
      exitPromise.then(() => true),
      sleep(timeoutMs).then(() => false),
    ]);
  } catch {
    return false;
  }
};

type MiniBackendRuntimeStatePatch = Partial<MiniBackendRuntimeState>;

/**
 * Narrow structural view of a spawned backend. `ChildProcess` satisfies it;
 * tests provide a fake without casting.
 */
interface MiniBackendChildProcess {
  readonly pid?: number;
  readonly killed: boolean;
  readonly stdout: NodeJS.ReadableStream | null;
  readonly stderr: NodeJS.ReadableStream | null;
  on(event: "exit", listener: (code: number | null) => void): this;
  on(event: "error", listener: (error: Error) => void): this;
  once(event: "exit", listener: (code: number | null) => void): this;
  kill(signal?: NodeJS.Signals): boolean;
}

interface MiniBackendSupervisorDeps {
  patchRuntimeState: (patch: MiniBackendRuntimeStatePatch) => void;
  pushRuntimeLog: (stream: "stdout" | "stderr", text: string) => void;
  /** Re-runs main.ts's existing spawn + health path. */
  restart: () => Promise<void>;
  /** Latched by before-quit / process exit; recovery never runs while true. */
  isAppExiting: () => boolean;
  /** Injected clock for the restart policy (tests). */
  now?: () => number;
  /** Injected delay scheduler; returns a cancel function (tests). */
  scheduleRestart?: (delayMs: number, callback: () => void) => () => void;
}

interface MiniBackendSupervisor<
  TChild extends MiniBackendChildProcess = ChildProcess,
> {
  /** Track a freshly spawned backend: generation, stream wiring + exit bookkeeping. */
  register: (child: TChild) => void;
  stop: () => Promise<void>;
  getProcess: () => TChild | null;
  /** Synchronous last-resort kill for the process.once("exit") handler. */
  runExitCleanup: () => void;
  /** Called by the spawn path once `/health` answered successfully. */
  markHealthy: () => void;
  /** Latch app shutdown so a scheduled restart can never fire during quit. */
  markAppExiting: () => void;
}

const MAX_STDERR_CAPTURE_CHARS = 20_000;

const defaultScheduleRestart = (
  delayMs: number,
  callback: () => void,
): (() => void) => {
  const timer = setTimeout(callback, delayMs);
  if (typeof timer.unref === "function") {
    timer.unref();
  }
  return () => {
    clearTimeout(timer);
  };
};

const forceStopMiniBackendProcess = (processRef: MiniBackendChildProcess | null): void => {
  if (!processRef || processRef.killed) {
    return;
  }

  const pid = processRef.pid;
  if (process.platform === "win32" && typeof pid === "number" && Number.isInteger(pid) && pid > 0) {
    try {
      execFileSync("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
        timeout: 3_000,
      });
      return;
    } catch {
      // Fall back to generic kill below.
    }
  }

  try {
    processRef.kill("SIGKILL");
  } catch {
    // Ignore process termination race conditions.
  }
};

/**
 * Maps backend log output onto runtime-state patches. The marker literals
 * below are LEGACY: the mini-backend no longer emits these English lines
 * (packages/mini-backend/app.py's warmup path emits dotted events
 * `warmup.failed` / `warmup.done`). The parser's own literals are the
 * authoritative source and are pinned by
 * ../tests/mini-backend-fallback-markers.test.ts.
 */
export const syncMiniBackendRuntimeStateFromLog = (
  rawText: string,
  patch: (next: MiniBackendRuntimeStatePatch) => void,
): void => {
  const text = rawText.trim();
  if (!text) {
    return;
  }

  const warmupFallbackReason = formatRuntimeFallbackReason("runtime_warmup_fallback_to_cpu");

  if (text.includes("Falling back to CPU automatically")) {
    patch({
      activeProfile: "cpu",
      lastError: warmupFallbackReason,
      status: "fallback",
      statusMessage: warmupFallbackReason,
    });
    return;
  }

  if (text.includes("Detector warmup successfully redone on CPU")) {
    patch({
      activeProfile: "cpu",
      lastError: warmupFallbackReason,
      status: "fallback",
      statusMessage: warmupFallbackReason,
    });
  }
};

const shouldIgnoreMiniBackendProgressNoise = (rawText: string): boolean => {
  const text = rawText.trim();
  if (!text) {
    return true;
  }
  return (
    /Progress:\s*\|/i.test(text) ||
    /onnxruntime is not built with CUDA 12\.x support/i.test(text)
  );
};

const decodeMiniBackendChunk = (chunk: Buffer): string => {
  const utf8 = chunk.toString("utf8");
  if (!utf8.includes("\uFFFD")) {
    return utf8;
  }

  // Some Windows-native provider stacks emit non-UTF8 bytes on stderr.
  // Prefer a permissive decode so diagnostics keep flowing instead of
  // polluting the app with unreadable chunks.
  return chunk.toString("latin1");
};

const createMiniBackendSupervisor = <
  TChild extends MiniBackendChildProcess = ChildProcess,
>(
  deps: MiniBackendSupervisorDeps,
): MiniBackendSupervisor<TChild> => {
  const policy = createMiniBackendRestartPolicy({ now: deps.now ?? (() => Date.now()) });
  const scheduleRestart = deps.scheduleRestart ?? defaultScheduleRestart;

  let processRef: TChild | null = null;
  let shutdownPromise: Promise<void> | null = null;
  let exitPromise: Promise<void> | null = null;
  // Stable reference for the synchronous process.once("exit") handler.
  // stop() nulls the tracked process before kill completes, so the exit
  // handler needs its own copy to guarantee the child is killed.
  let processForExitCleanup: TChild | null = null;

  let generation = 0;
  let expectedStop = false;
  let appExitingLatched = false;
  let currentGenerationHealthy = false;
  let terminalFailureGeneration: number | null = null;
  let stderrCapture = "";
  let cancelScheduledRestart: (() => void) | null = null;
  let restartInFlight = false;

  const isAppExiting = (): boolean => appExitingLatched || deps.isAppExiting();

  const cancelPendingRestart = (): void => {
    if (!cancelScheduledRestart) {
      return;
    }
    cancelScheduledRestart();
    cancelScheduledRestart = null;
  };

  const captureStderr = (text: string): void => {
    stderrCapture += text;
    if (stderrCapture.length > MAX_STDERR_CAPTURE_CHARS) {
      stderrCapture = stderrCapture.slice(-MAX_STDERR_CAPTURE_CHARS);
    }
  };

  const scheduleRestartDecision = (
    decision: MiniBackendRestartDecision,
    childGeneration: number,
  ): void => {
    if (decision.action === "stop") {
      console.error(
        `[mini-backend] automatic recovery stopped (${decision.reason}) ` +
          `after ${decision.attempt} attempt(s)`,
      );
      return;
    }

    console.warn(
      `[mini-backend] restarting in ${decision.delayMs} ms ` +
        `(attempt ${decision.attempt}/${policy.getMaxAttempts()})`,
    );
    cancelPendingRestart();
    cancelScheduledRestart = scheduleRestart(decision.delayMs, () => {
      cancelScheduledRestart = null;
      void runRestart(childGeneration, decision.attempt);
    });
  };

  const handleRestartFailure = (error: Error): void => {
    const message = redactMiniBackendSecrets(error.message);
    const lastStderr = formatMiniBackendCrashStderr(stderrCapture);

    if (error instanceof MiniBackendRestartError && error.kind === "health-timeout") {
      const decision = policy.recordHealthTimeout();
      deps.patchRuntimeState({
        status: "crashed",
        statusMessage:
          `Local backend did not become healthy after a restart; ` +
          `restart attempt ${decision.attempt}/${policy.getMaxAttempts()}.`,
        lastError: "mini_backend_health_timeout",
        attempt: decision.attempt,
        maxAttempts: policy.getMaxAttempts(),
        exitCode: null,
        lastStderr,
        crashLogPath: null,
        progress: null,
      });
      console.error(`[mini-backend] restart health timeout; stderr tail:\n${lastStderr || "<empty>"}`);
      scheduleRestartDecision(decision, generation);
      return;
    }

    terminalFailureGeneration = generation;
    const decision = policy.recordSpawnFailure("spawn-error");
    deps.patchRuntimeState({
      status: "error",
      statusMessage: "Local backend could not be restarted; automatic recovery stopped.",
      lastError: message,
      attempt: decision.attempt,
      maxAttempts: policy.getMaxAttempts(),
      exitCode: null,
      lastStderr,
      crashLogPath: null,
      progress: null,
    });
    console.error(`[mini-backend] restart failed (no retry): ${message}`);
  };

  const runRestart = async (scheduledGeneration: number, attempt: number): Promise<void> => {
    if (isAppExiting() || scheduledGeneration !== generation || restartInFlight) {
      return;
    }

    restartInFlight = true;
    deps.patchRuntimeState({
      status: "starting",
      statusMessage:
        `Restarting local backend (attempt ${attempt}/${policy.getMaxAttempts()}).`,
      attempt,
      maxAttempts: policy.getMaxAttempts(),
      progress: null,
    });

    try {
      await deps.restart();
      if (isAppExiting()) {
        await stop();
      }
    } catch (error) {
      if (scheduledGeneration !== generation) {
        return;
      }
      handleRestartFailure(
        error instanceof Error ? error : new Error("unknown restart failure"),
      );
    } finally {
      restartInFlight = false;
    }
  };

  const handleUnexpectedExit = (
    childGeneration: number,
    code: number | null,
  ): void => {
    const healthConfirmed = currentGenerationHealthy;
    currentGenerationHealthy = false;
    const lastStderr = formatMiniBackendCrashStderr(stderrCapture);
    const exitCodeLabel = code === null ? "unknown" : String(code);
    const decision = policy.recordUnexpectedExit({ exitCode: code, healthConfirmed });
    const statusMessage =
      decision.action === "restart"
        ? `Local backend exited unexpectedly (code ${exitCodeLabel}); ` +
          `restart attempt ${decision.attempt}/${policy.getMaxAttempts()}.`
        : `Local backend exited unexpectedly (code ${exitCodeLabel}); ` +
          `automatic recovery stopped (${decision.reason}).`;

    deps.patchRuntimeState({
      status: "crashed",
      statusMessage,
      lastError: `mini_backend_exit_${exitCodeLabel}`,
      attempt: decision.attempt,
      maxAttempts: policy.getMaxAttempts(),
      exitCode: code,
      lastStderr,
      crashLogPath: null,
      progress: null,
    });
    console.error(
      `[mini-backend] unexpected exit code ${exitCodeLabel}; ` +
        `stderr tail:\n${lastStderr || "<empty>"}`,
    );

    scheduleRestartDecision(decision, childGeneration);
  };

  const register = (child: TChild): void => {
    generation += 1;
    const childGeneration = generation;
    expectedStop = false;
    currentGenerationHealthy = false;
    terminalFailureGeneration = null;
    stderrCapture = "";
    cancelPendingRestart();

    processRef = child;
    processForExitCleanup = child;

    child.stdout?.on("data", (chunk: Buffer) => {
      const text = decodeMiniBackendChunk(chunk);
      if (shouldIgnoreMiniBackendProgressNoise(text)) {
        return;
      }
      deps.pushRuntimeLog("stdout", text);
      syncMiniBackendRuntimeStateFromLog(text, deps.patchRuntimeState);
      console.log(`[mini-backend] ${text.trim()}`);
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      const text = decodeMiniBackendChunk(chunk);
      if (shouldIgnoreMiniBackendProgressNoise(text)) {
        return;
      }
      captureStderr(text);
      deps.pushRuntimeLog("stderr", text);
      syncMiniBackendRuntimeStateFromLog(text, deps.patchRuntimeState);
      console.error(`[mini-backend:err] ${text.trim()}`);
    });

    const currentProcess = child;
    const currentExitPromise = new Promise<void>((resolve) => {
      currentProcess.once("exit", () => {
        resolve();
      });
    });
    exitPromise = currentExitPromise;

    child.on("error", (error) => {
      if (childGeneration !== generation || isAppExiting()) {
        return;
      }
      terminalFailureGeneration = childGeneration;
      cancelPendingRestart();
      const message = redactMiniBackendSecrets(error.message);
      const decision = policy.recordSpawnFailure("spawn-error");
      deps.patchRuntimeState({
        status: "error",
        statusMessage: "Local backend failed to spawn; automatic recovery stopped.",
        lastError: message,
        attempt: decision.attempt,
        maxAttempts: policy.getMaxAttempts(),
        exitCode: null,
        lastStderr: formatMiniBackendCrashStderr(stderrCapture),
        crashLogPath: null,
        progress: null,
      });
      console.error(`[mini-backend] spawn failed (no retry): ${message}`);
    });

    child.on("exit", (code) => {
      console.log(`[mini-backend] exited with code ${code ?? "unknown"}`);

      if (processRef === currentProcess) {
        processRef = null;
      }
      if (processForExitCleanup === currentProcess) {
        processForExitCleanup = null;
      }
      if (exitPromise === currentExitPromise) {
        exitPromise = null;
      }

      if (childGeneration !== generation) {
        return;
      }
      if (terminalFailureGeneration === childGeneration) {
        return;
      }
      if (expectedStop || isAppExiting()) {
        return;
      }

      handleUnexpectedExit(childGeneration, code);
    });
  };

  const stop = async (): Promise<void> => {
    expectedStop = true;
    cancelPendingRestart();

    if (shutdownPromise) {
      await shutdownPromise;
      return;
    }

    const stoppingProcess = processRef;
    const stoppingExitPromise = exitPromise;
    processRef = null;
    exitPromise = null;

    if (!stoppingProcess || stoppingProcess.killed) {
      return;
    }

    shutdownPromise = (async () => {
      try {
        stoppingProcess.kill("SIGTERM");
      } catch {
        // Ignore process termination race conditions.
      }

      const exitedGracefully = await waitForMiniBackendProcessExit(stoppingExitPromise, 2_500);
      if (exitedGracefully) {
        return;
      }

      forceStopMiniBackendProcess(stoppingProcess);
      await waitForMiniBackendProcessExit(stoppingExitPromise, 2_000);
    })();

    try {
      await shutdownPromise;
    } finally {
      shutdownPromise = null;
    }
  };

  const runExitCleanup = (): void => {
    appExitingLatched = true;
    expectedStop = true;
    cancelPendingRestart();
    forceStopMiniBackendProcess(processForExitCleanup);
    processForExitCleanup = null;
    processRef = null;
    exitPromise = null;
  };

  const markHealthy = (): void => {
    currentGenerationHealthy = true;
    policy.noteHealthy();
  };

  const markAppExiting = (): void => {
    appExitingLatched = true;
    cancelPendingRestart();
  };

  return {
    register,
    stop,
    getProcess: () => processRef,
    runExitCleanup,
    markHealthy,
    markAppExiting,
  };
};

export { createMiniBackendSupervisor };
export type {
  MiniBackendChildProcess,
  MiniBackendRuntimeStatePatch,
  MiniBackendSupervisor,
  MiniBackendSupervisorDeps,
};
export { MINI_BACKEND_CRASH_STDERR_MAX_CHARS };
