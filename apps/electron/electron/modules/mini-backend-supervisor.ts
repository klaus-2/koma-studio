/**
 * Mini-backend child-process supervisor: spawn registration, log-stream
 * wiring, the legacy CPU-fallback log-marker parser, graceful-stop
 * sequencing and app-exit cleanup.
 * Pure node — no electron imports — unit-testable under node:test.
 */
import { execFileSync, type ChildProcess } from "node:child_process";

import { formatRuntimeFallbackReason } from "../mini-backend-runtime.ts";
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

interface MiniBackendSupervisorDeps {
  patchRuntimeState: (patch: MiniBackendRuntimeStatePatch) => void;
  pushRuntimeLog: (stream: "stdout" | "stderr", text: string) => void;
}

interface MiniBackendSupervisor {
  /** Track a freshly spawned backend: stream wiring + exit bookkeeping. */
  register: (child: ChildProcess) => void;
  stop: () => Promise<void>;
  getProcess: () => ChildProcess | null;
  /** Synchronous last-resort kill for the process.once("exit") handler. */
  runExitCleanup: () => void;
}

const forceStopMiniBackendProcess = (processRef: ChildProcess | null): void => {
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

const createMiniBackendSupervisor = (deps: MiniBackendSupervisorDeps): MiniBackendSupervisor => {
  let processRef: ChildProcess | null = null;
  let shutdownPromise: Promise<void> | null = null;
  let exitPromise: Promise<void> | null = null;
  // Stable reference for the synchronous process.once("exit") handler.
  // stop() nulls the tracked process before kill completes, so the exit
  // handler needs its own copy to guarantee the child is killed.
  let processForExitCleanup: ChildProcess | null = null;

  const register = (child: ChildProcess): void => {
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
    });
  };

  const stop = async (): Promise<void> => {
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
    forceStopMiniBackendProcess(processForExitCleanup);
    processForExitCleanup = null;
    processRef = null;
    exitPromise = null;
  };

  return {
    register,
    stop,
    getProcess: () => processRef,
    runExitCleanup,
  };
};

export { createMiniBackendSupervisor };
export type {
  MiniBackendRuntimeStatePatch,
  MiniBackendSupervisor,
  MiniBackendSupervisorDeps,
};
