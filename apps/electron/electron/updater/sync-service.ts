import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  createInitialUpdaterSyncState,
  UPDATER_SYNC_IPC,
  UPDATER_SYNC_LOG_CAP,
  type UpdaterSyncPhase,
  type UpdaterSyncState,
  type UpdaterSyncStepId,
} from "../../../../packages/types/src/updaterSync.ts";

const getDevServerOrigin = (): string | null => {
  if (!process.env.VITE_DEV_SERVER_URL) {
    return null;
  }

  try {
    return new URL(process.env.VITE_DEV_SERVER_URL).origin;
  } catch {
    return null;
  }
};

const INTERNAL_APP_PROTOCOL = "app";
const INTERNAL_APP_HOST = "local";

const isInternalAppUrl = (rawUrl: string): boolean => {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === `${INTERNAL_APP_PROTOCOL}:` && parsed.hostname === INTERNAL_APP_HOST;
  } catch {
    return false;
  }
};

const isTrustedSyncSender = (event: IpcMainInvokeEvent): boolean => {
  const senderUrl = event.senderFrame?.url || event.sender.getURL();
  if (!senderUrl) {
    return false;
  }

  const devOrigin = getDevServerOrigin();
  if (devOrigin) {
    try {
      return new URL(senderUrl).origin === devOrigin;
    } catch {
      return false;
    }
  }

  return isInternalAppUrl(senderUrl);
};

const assertTrustedSyncSender = (event: IpcMainInvokeEvent, channel: string): void => {
  if (isTrustedSyncSender(event)) {
    return;
  }

  const senderUrl = event.senderFrame?.url || event.sender.getURL() || "unknown-url";
  throw new Error(`Blocked IPC on "${channel}" from untrusted sender (${senderUrl}).`);
};

/* ─── Process helpers ────────────────────────────────────────────────────── */

interface SpawnLineEvent {
  stream: "stdout" | "stderr";
  line: string;
}

interface SpawnResult {
  code: number;
}

const bufferTail = (lines: string[], cap: number): string[] =>
  lines.length > cap ? lines.slice(lines.length - cap) : lines;

const REPO_ROOT_MAX_DEPTH = 8;

const findRepoRoot = (): string | null => {
  const candidates = [app.getAppPath(), process.cwd()];
  for (const candidate of candidates) {
    let cursor: string | null = null;
    try {
      cursor = path.resolve(candidate);
    } catch {
      continue;
    }

    for (let depth = 0; depth < REPO_ROOT_MAX_DEPTH; depth += 1) {
      if (fs.existsSync(path.join(cursor, ".git"))) {
        return cursor;
      }
      const parent = path.dirname(cursor);
      if (parent === cursor) {
        break;
      }
      cursor = parent;
    }
  }

  return null;
};

interface RunStepOptions {
  command: string;
  args: string[];
  cwd: string;
  onLine: (event: SpawnLineEvent) => void;
  /** Resolved when the process is spawned; used for cancellation. */
  onSpawn?: (child: ChildProcess) => void;
}

const runStep = (options: RunStepOptions): Promise<SpawnResult> =>
  new Promise<SpawnResult>((resolve) => {
    let child: ChildProcess;
    try {
      child = spawn(options.command, options.args, {
        cwd: options.cwd,
        env: process.env,
        windowsHide: true,
      });
    } catch (error) {
      options.onLine({
        stream: "stderr",
        line: error instanceof Error ? error.message : `Failed to spawn ${options.command}.`,
      });
      resolve({ code: -1 });
      return;
    }

    options.onSpawn?.(child);

    const collect = (stream: "stdout" | "stderr", chunk: Buffer): void => {
      const text = chunk.toString("utf8");
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.replace(/\r$/, "");
        if (trimmed.length > 0) {
          options.onLine({ stream, line: trimmed });
        }
      }
    };

    child.stdout?.on("data", (chunk: Buffer) => collect("stdout", chunk));
    child.stderr?.on("data", (chunk: Buffer) => collect("stderr", chunk));

    child.on("error", (error) => {
      options.onLine({
        stream: "stderr",
        line: error instanceof Error ? error.message : `Failed to run ${options.command}.`,
      });
      resolve({ code: -1 });
    });

    child.on("close", (code) => {
      resolve({ code: typeof code === "number" ? code : -1 });
    });
  });

const killProcessTree = (child: ChildProcess): void => {
  const pid = child.pid;
  if (!pid) {
    return;
  }

  if (process.platform === "win32") {
    try {
      spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true });
      return;
    } catch {
      // fall through to child.kill()
    }
  }

  child.kill("SIGTERM");
};

/* ─── Service ────────────────────────────────────────────────────────────── */

type StepRunner = (context: SyncRunContext) => Promise<boolean>;

interface SyncRunContext {
  repoRoot: string;
  appsElectronDir: string;
}

const stepSnapshotIndex = (state: UpdaterSyncState, step: UpdaterSyncStepId): number =>
  state.steps.findIndex((entry) => entry.id === step);

const markStep = (state: UpdaterSyncState, step: UpdaterSyncStepId, next: UpdaterSyncState["steps"][number]["state"]): void => {
  const index = stepSnapshotIndex(state, step);
  if (index >= 0) {
    state.steps[index] = { id: step, state: next };
  }
};

const skipFollowingSteps = (state: UpdaterSyncState, fromIndex: number): void => {
  for (let index = fromIndex + 1; index < state.steps.length; index += 1) {
    const entry = state.steps[index];
    if (entry && entry.state === "pending") {
      state.steps[index] = { id: entry.id, state: "skipped" };
    }
  }
};

class UpdaterSyncService {
  private state: UpdaterSyncState = createInitialUpdaterSyncState();
  private running = false;
  private cancelRequested = false;
  private activeChild: ChildProcess | null = null;

  getStatus = (): UpdaterSyncState => this.state;

  private snapshot = (): UpdaterSyncState => ({
    ...this.state,
    steps: this.state.steps.map((entry) => ({ ...entry })),
    dirtyFiles: [...this.state.dirtyFiles],
    logLines: [...this.state.logLines],
  });

  private broadcast = (): void => {
    const payload = { state: this.snapshot() };
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(UPDATER_SYNC_IPC.event, payload);
      }
    }
  };

  private appendLog = (line: string): void => {
    this.state.logLines = bufferTail([...this.state.logLines, line], UPDATER_SYNC_LOG_CAP);
    this.broadcast();
  };

  private setPhase = (phase: UpdaterSyncPhase): void => {
    this.state.phase = phase;
    this.broadcast();
  };

  private failStep = (step: UpdaterSyncStepId, message: string): void => {
    markStep(this.state, step, "failed");
    skipFollowingSteps(this.state, stepSnapshotIndex(this.state, step));
    this.state.error = message;
    this.state.finishedAt = Date.now();
    this.setPhase("failed");
  };

  private runSteps = async (
    runners: Array<{ id: UpdaterSyncStepId; run: StepRunner }>,
    context: SyncRunContext,
  ): Promise<void> => {
    for (const runner of runners) {
      if (this.cancelRequested) {
        markStep(this.state, runner.id, "skipped");
        this.state.error = "Sync canceled by user.";
        this.state.finishedAt = Date.now();
        this.setPhase("failed");
        return;
      }

      markStep(this.state, runner.id, "running");
      this.broadcast();

      const ok = await runner.run(context);
      if (!ok) {
        // failStep already set terminal state.
        return;
      }

      if (this.cancelRequested) {
        markStep(this.state, runner.id, "ok");
        this.state.error = "Sync canceled by user.";
        this.state.finishedAt = Date.now();
        this.setPhase("failed");
        return;
      }

      markStep(this.state, runner.id, "ok");
      this.broadcast();
    }
  };

  private makeRunner =
    (step: UpdaterSyncStepId, command: string, args: (context: SyncRunContext) => string[], cwd: (context: SyncRunContext) => string): StepRunner =>
      async (context) => {
        const result = await runStep({
          command,
          args: args(context),
          cwd: cwd(context),
          onLine: (event) => {
            this.appendLog(`[${step}] ${event.line}`);
          },
          onSpawn: (child) => {
            this.activeChild = child;
          },
        });

        this.activeChild = null;

        if (result.code !== 0) {
          this.failStep(step, `${command} exited with code ${result.code}.`);
          return false;
        }

        return true;
      };

  private readonly pullRunner = this.makeRunner(
    "pull",
    "git",
    () => ["pull", "--ff-only"],
    (context) => context.repoRoot,
  );

  private readonly installRunner = this.makeRunner(
    "install",
    "bun",
    () => ["install"],
    (context) => context.repoRoot,
  );

  private readonly venvRunner = this.makeRunner(
    "venv",
    "bun",
    () => ["run", "mini:install-deps"],
    (context) => context.appsElectronDir,
  );

  private readonly buildRunner = this.makeRunner(
    "build",
    "bun",
    () => ["run", "build:app"],
    (context) => context.appsElectronDir,
  );

  private startRun = async (runners: Array<{ id: UpdaterSyncStepId; run: StepRunner }>, phase: UpdaterSyncPhase): Promise<UpdaterSyncState> => {
    if (this.running) {
      throw new Error("A sync run is already in progress.");
    }

    this.running = true;
    this.cancelRequested = false;
    this.state = createInitialUpdaterSyncState();
    this.state.startedAt = Date.now();
    this.broadcast();

    const repoRoot = findRepoRoot();
    if (!repoRoot) {
      this.state.error = "Source repository not found (no .git directory above the app).";
      this.state.finishedAt = Date.now();
      this.setPhase("failed");
      this.running = false;
      return this.snapshot();
    }

    const context: SyncRunContext = {
      repoRoot,
      appsElectronDir: path.join(repoRoot, "apps", "electron"),
    };

    this.setPhase(phase);

    await this.runSteps(runners, context);

    if (this.state.phase === phase) {
      this.state.finishedAt = Date.now();
      this.setPhase("awaiting-rebuild");
    }

    this.running = false;
    return this.snapshot();
  };

  start = async (): Promise<UpdaterSyncState> => {
    await this.runPrecheck();
    if (this.state.phase === "failed") {
      return this.snapshot();
    }

    return this.startRun(
      [
        { id: "pull", run: this.pullRunner },
        { id: "install", run: this.installRunner },
        { id: "venv", run: this.venvRunner },
      ],
      "running",
    );
  };

  rebuildAndRestart = async (): Promise<UpdaterSyncState> => {
    const finalState = await this.startRun([{ id: "build", run: this.buildRunner }], "rebuilding");

    if (finalState.phase === "awaiting-rebuild") {
      this.state.finishedAt = Date.now();
      this.setPhase("completed");
      setTimeout(() => {
        app.relaunch();
        app.exit(0);
      }, 400);
    }

    return finalState;
  };

  private runPrecheck = async (): Promise<void> => {
    if (this.running) {
      throw new Error("A sync run is already in progress.");
    }

    this.running = true;
    this.cancelRequested = false;
    this.state = createInitialUpdaterSyncState();
    this.state.startedAt = Date.now();
    this.setPhase("precheck");

    const repoRoot = findRepoRoot();
    if (!repoRoot) {
      this.state.error = "Source repository not found (no .git directory above the app).";
      this.state.finishedAt = Date.now();
      this.setPhase("failed");
      this.running = false;
      return;
    }

    const status = await runStep({
      command: "git",
      args: ["status", "--porcelain", "--untracked-files=no"],
      cwd: repoRoot,
      onLine: (event) => {
        if (event.stream === "stdout" && event.line.trim().length > 0) {
          this.state.dirtyFiles = bufferTail([...this.state.dirtyFiles, event.line.trim()], 200);
        }
      },
    });

    if (this.state.dirtyFiles.length > 0) {
      this.state.error = "Working tree has uncommitted changes — commit or stash them before syncing.";
      this.state.finishedAt = Date.now();
      this.setPhase("failed");
      this.running = false;
      return;
    }

    if (status.code !== 0) {
      this.state.error = "git is not available on PATH.";
      this.state.finishedAt = Date.now();
      this.setPhase("failed");
      this.running = false;
      return;
    }

    this.running = false;
  };

  cancel = (): void => {
    if (!this.running) {
      return;
    }

    this.cancelRequested = true;
    const child = this.activeChild;
    if (child) {
      killProcessTree(child);
      this.activeChild = null;
    }
  };
}

/* ─── IPC registration ───────────────────────────────────────────────────── */

let service: UpdaterSyncService | null = null;

export const registerUpdaterSyncService = (): void => {
  if (service) {
    return;
  }

  const instance = new UpdaterSyncService();
  service = instance;

  ipcMain.handle(UPDATER_SYNC_IPC.start, async (event) => {
    assertTrustedSyncSender(event, UPDATER_SYNC_IPC.start);
    return instance.start();
  });

  ipcMain.handle(UPDATER_SYNC_IPC.cancel, async (event) => {
    assertTrustedSyncSender(event, UPDATER_SYNC_IPC.cancel);
    instance.cancel();
    return instance.getStatus();
  });

  ipcMain.handle(UPDATER_SYNC_IPC.rebuild, async (event) => {
    assertTrustedSyncSender(event, UPDATER_SYNC_IPC.rebuild);
    return instance.rebuildAndRestart();
  });

  ipcMain.handle(UPDATER_SYNC_IPC.getStatus, async (event) => {
    assertTrustedSyncSender(event, UPDATER_SYNC_IPC.getStatus);
    return instance.getStatus();
  });
};

export const getUpdaterSyncStatusSnapshot = (): UpdaterSyncState =>
  service?.getStatus() ?? createInitialUpdaterSyncState();
