import { BrowserWindow, app } from "electron";
import { autoUpdater } from "electron-updater";
import type {
  UpdaterChannel,
  UpdaterEventPayload,
  UpdaterProgressPayload,
  UpdaterStatusPayload,
} from "../../../../packages/types/src/desktop-events.ts";
import { desktopCommandChannels } from "../../../../packages/types/src/desktop-api.ts";
import { registerSecureIpcHandler } from "../modules/shared.ts";
import {
  applyUpdaterTransition,
  createInitialUpdaterState,
  normalizeUpdaterReleaseNotes,
  updaterTransitionEventName,
  type UpdaterTransition,
} from "./installer-updater-shared.ts";

const UPDATER_EVENT_CHANNEL = "updater:event";

const isInstallerUpdateSupported = (): boolean =>
  app.isPackaged && process.platform === "win32";

const parseChannelRequest = (value: unknown): UpdaterChannel => {
  const payload = (value ?? {}) as Record<string, unknown>;
  if (payload.channel === "stable" || payload.channel === "beta") {
    return payload.channel;
  }
  throw new Error("Invalid update channel.");
};

const toUpdaterProgress = (progress: {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}): UpdaterProgressPayload => ({
  percent: progress.percent,
  transferred: progress.transferred,
  total: progress.total,
  speed: progress.bytesPerSecond,
});

class InstallerUpdaterService {
  private state: UpdaterStatusPayload;
  private lastChannel: UpdaterChannel = "stable";
  private eventsWired = false;
  private installScheduled = false;

  constructor() {
    this.state = createInitialUpdaterState(app.getVersion());
  }

  private transition(transition: UpdaterTransition): void {
    this.state = applyUpdaterTransition(this.state, transition, this.lastChannel);
    const payload: UpdaterEventPayload = {
      event: updaterTransitionEventName(transition),
      state: this.state,
    };
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(UPDATER_EVENT_CHANNEL, payload);
      }
    }
  }

  private clearInstallLatch(): void {
    this.installScheduled = false;
  }

  private applyChannel(channel: UpdaterChannel): void {
    this.lastChannel = channel;
    autoUpdater.allowPrerelease = channel === "beta";
  }

  private wireEventsOnce(): void {
    if (this.eventsWired) {
      return;
    }
    this.eventsWired = true;

    autoUpdater.on("checking-for-update", () => {
      this.clearInstallLatch();
      this.transition({ type: "checking" });
    });

    autoUpdater.on("update-available", (info) => {
      this.clearInstallLatch();
      this.transition({
        type: "available",
        version: info.version,
        releaseNotes: normalizeUpdaterReleaseNotes(info.releaseNotes),
        checkedAt: Date.now(),
      });
    });

    autoUpdater.on("update-not-available", () => {
      this.clearInstallLatch();
      this.transition({ type: "not-available", checkedAt: Date.now() });
    });

    autoUpdater.on("download-progress", (progress) => {
      this.transition({ type: "progress", progress: toUpdaterProgress(progress) });
    });

    autoUpdater.on("update-downloaded", () => {
      this.transition({ type: "downloaded", downloadedAt: Date.now() });
    });

    autoUpdater.on("error", (error) => {
      this.transition({ type: "error", message: error.message });
    });
  }

  registerIpcHandlers(): void {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    this.wireEventsOnce();

    registerSecureIpcHandler<UpdaterStatusPayload | null>(
      desktopCommandChannels.updater.getState,
      async () => (isInstallerUpdateSupported() ? this.state : null),
    );

    registerSecureIpcHandler<void>(
      desktopCommandChannels.updater.download,
      async (value) => {
        if (!isInstallerUpdateSupported()) {
          throw new Error("Installer updates are not available in this environment.");
        }
        if (this.state.status === "downloading") {
          return;
        }
        this.applyChannel(parseChannelRequest(value));
        await autoUpdater.checkForUpdates();
        await autoUpdater.downloadUpdate();
      },
    );

    registerSecureIpcHandler<{ installing: boolean }>(
      desktopCommandChannels.updater.install,
      async () => {
        if (!isInstallerUpdateSupported() || this.state.status !== "downloaded") {
          throw new Error("No downloaded update is ready to install.");
        }
        if (this.installScheduled) {
          throw new Error("Update installation is already in progress.");
        }
        this.installScheduled = true;
        setTimeout(() => {
          autoUpdater.quitAndInstall(true, true);
        }, 0);
        return { installing: true };
      },
    );
  }
}

const service = new InstallerUpdaterService();

export const registerInstallerUpdaterService = (): void => {
  service.registerIpcHandlers();
};
