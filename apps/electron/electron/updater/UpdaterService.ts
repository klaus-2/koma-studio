import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from "electron";
import log from "electron-log";
import {
  AppUpdater,
  autoUpdater,
  ProgressInfo,
  UpdateDownloadedEvent,
  UpdateInfo,
} from "electron-updater";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  createUpdaterRuntimeConfig,
  getGenericProviderChannel,
  isPrereleaseAllowed,
  toFeedOptions,
} from "./config";
import type {
  UpdateChannel,
  UpdaterEventName,
  UpdaterEventPayload,
  UpdaterState,
} from "./types";

type UpdateInfoWithMandatory = UpdateInfo & {
  mandatory?: boolean | string | number | null;
};

type PackageFileInfoLike = {
  path?: string | null;
  file?: string | null;
  size?: number | string | null;
  sha512?: string | null;
};

type UpdateFileInfoLike = {
  url?: string | null;
  size?: number | string | null;
};

type UpdateInfoWithPackages = UpdateInfoWithMandatory & {
  path?: string | null;
  files?: UpdateFileInfoLike[] | null;
  packages?: Record<string, PackageFileInfoLike | undefined> | null;
};

type DownloadOptionsLike = {
  headers?: Record<string, unknown> | null;
  sha512?: string | null;
  cancellationToken?: unknown;
  onProgress?: (progress: ProgressInfo) => void;
};

type HttpExecutorLike = {
  download: (url: URL | string, destinationFile: string, options: DownloadOptionsLike) => Promise<unknown>;
};

const CHECK_DELAY_MS = 8_000;
const PERIODIC_CHECK_MS = 60 * 1_000;

const IPC_CHANNEL_CHECK = "updater:check";
const IPC_CHANNEL_DOWNLOAD = "updater:download";
const IPC_CHANNEL_INSTALL = "updater:install";
const IPC_CHANNEL_POSTPONE = "updater:postpone";
const IPC_CHANNEL_GET_STATUS = "updater:get-status";
const IPC_CHANNEL_SET_CHANNEL = "updater:set-channel";
const IPC_CHANNEL_SET_AUTO_INSTALL = "updater:set-auto-install";
const IPC_CHANNEL_EVENT = "updater:event";
const INTERNAL_APP_PROTOCOL = "app";
const INTERNAL_APP_HOST = "local";

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

const isInternalAppUrl = (rawUrl: string): boolean => {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === `${INTERNAL_APP_PROTOCOL}:` && parsed.hostname === INTERNAL_APP_HOST;
  } catch {
    return false;
  }
};

const isTrustedUpdaterSender = (event: IpcMainInvokeEvent): boolean => {
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

const assertTrustedUpdaterSender = (event: IpcMainInvokeEvent, channel: string): void => {
  if (isTrustedUpdaterSender(event)) {
    return;
  }

  const senderUrl = event.senderFrame?.url || event.sender.getURL() || "unknown-url";
  throw new Error(`Blocked IPC on "${channel}" from untrusted sender (${senderUrl}).`);
};

const normalizeReleaseNotes = (releaseNotes: UpdateInfo["releaseNotes"]): string | null => {
  if (!releaseNotes) {
    return null;
  }

  if (typeof releaseNotes === "string") {
    const normalized = releaseNotes.trim();
    return normalized.length > 0 ? normalized : null;
  }

  const notes = releaseNotes
    .map((entry) => `${entry.version}\n${entry.note}`)
    .join("\n\n")
    .trim();

  return notes.length > 0 ? notes : null;
};

const safeErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown update system error.";
};

const isMissingChannelManifestError = (error: unknown): boolean => {
  if (error && typeof error === "object") {
    const maybeCode = (error as { code?: unknown }).code;
    if (typeof maybeCode === "string" && maybeCode === "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND") {
      return true;
    }
  }

  const message = safeErrorMessage(error).toLowerCase();
  if (message.includes("err_updater_channel_file_not_found")) {
    return true;
  }
  if (message.includes("cannot find channel") && message.includes(".yml")) {
    return true;
  }
  if (message.includes(".yml") && message.includes("httperror: 404")) {
    return true;
  }

  return false;
};

const normalizeSha512 = (value: string): string => value.replace(/^sha512-/i, "").trim();

const normalizeVersionText = (value: string | null | undefined): string =>
  String(value ?? "")
    .trim()
    .replace(/^v/i, "");

const toPositiveNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const toPathIdentity = (value: string | URL | null | undefined): { full: string; base: string } | null => {
  if (!value) {
    return null;
  }

  const rawValue = value instanceof URL ? value.href : String(value).trim();
  if (!rawValue) {
    return null;
  }

  let normalizedPath = rawValue;
  try {
    normalizedPath = new URL(rawValue).pathname;
  } catch {
    normalizedPath = rawValue;
  }

  const decodedPath = decodeURIComponent(normalizedPath)
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/\?.*$/, "")
    .replace(/#.*$/, "")
    .replace(/\/$/, "");

  return {
    full: decodedPath.toLowerCase(),
    base: path.basename(decodedPath).toLowerCase(),
  };
};

const getArchPackageCandidates = (): string[] => {
  switch (process.arch) {
    case "arm64":
      return ["arm64", "x64", "ia32"];
    case "ia32":
      return ["ia32", "x64"];
    default:
      return [process.arch, "x64", "ia32"];
  }
};

const getUpdateDownloadMetadata = (info: UpdateInfo): {
  installerSize: number;
  installerPath: string | null;
  packageSize: number;
  packagePath: string | null;
} => {
  const typedInfo = info as UpdateInfoWithPackages;
  const primaryFile = Array.isArray(typedInfo.files) ? typedInfo.files[0] : null;
  const installerSize = toPositiveNumber(primaryFile?.size);
  const installerPath =
    typeof typedInfo.path === "string" && typedInfo.path.trim().length > 0
      ? typedInfo.path.trim()
      : typeof primaryFile?.url === "string" && primaryFile.url.trim().length > 0
        ? primaryFile.url.trim()
        : null;

  const packages = typedInfo.packages && typeof typedInfo.packages === "object" ? typedInfo.packages : null;
  const packageInfo =
    packages === null
      ? null
      : getArchPackageCandidates()
          .map((candidate) => packages[candidate] ?? null)
          .find((entry) => entry !== null) ?? null;

  const packageSize = toPositiveNumber(packageInfo?.size);
  const packagePath =
    typeof packageInfo?.path === "string" && packageInfo.path.trim().length > 0
      ? packageInfo.path.trim()
      : typeof packageInfo?.file === "string" && packageInfo.file.trim().length > 0
        ? packageInfo.file.trim()
        : null;

  return {
    installerSize,
    installerPath,
    packageSize,
    packagePath,
  };
};

const computeFileSha512 = async (filePath: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const hash = createHash("sha512");
    const stream = fs.createReadStream(filePath);

    stream.on("data", (chunk) => {
      hash.update(chunk);
    });
    stream.on("error", reject);
    stream.on("end", () => {
      resolve(hash.digest("base64"));
    });
  });

const toChannel = (value: unknown): UpdateChannel => {
  if (value === "beta") {
    return "beta";
  }

  return "stable";
};

const parseMandatoryFlag = (info: UpdateInfo | null | undefined): boolean => {
  const rawValue = (info as UpdateInfoWithMandatory | null | undefined)?.mandatory;
  if (typeof rawValue === "boolean") {
    return rawValue;
  }
  if (typeof rawValue === "number") {
    return rawValue !== 0;
  }
  if (typeof rawValue === "string") {
    const normalized = rawValue.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }

  return false;
};

export class UpdaterService {
  private static instance: UpdaterService | null = null;

  public static getInstance(resolveEnv: (key: string) => string | null): UpdaterService {
    if (!UpdaterService.instance) {
      UpdaterService.instance = new UpdaterService(resolveEnv);
    }

    return UpdaterService.instance;
  }

  private readonly updater: AppUpdater;
  private readonly runtimeConfig;
  private readonly state: UpdaterState;

  private mainWindow: BrowserWindow | null = null;
  private periodicCheckTimer: NodeJS.Timeout | null = null;
  private delayedCheckTimer: NodeJS.Timeout | null = null;
  private checkInFlight: Promise<void> | null = null;
  private downloadInFlight: Promise<void> | null = null;
  private downloadedFileVerified = false;
  private initialized = false;
  private ipcRegistered = false;
  private expectedInstallerFileSize = 0;
  private expectedPackageFileSize = 0;
  private expectedPackagePath: string | null = null;
  private httpExecutorPatched = false;
  private allowChannelSwitchDownloadOnNextCheck = false;

  private constructor(resolveEnv: (key: string) => string | null) {
    this.runtimeConfig = createUpdaterRuntimeConfig(resolveEnv, app.getVersion());
    this.state = {
      status: "idle",
      currentVersion: app.getVersion(),
      newVersion: null,
      mandatory: false,
      blocking: false,
      blockingReason: null,
      releaseNotes: null,
      channel: this.runtimeConfig.initialChannel,
      provider: this.runtimeConfig.provider,
      autoInstallOnQuit: this.runtimeConfig.autoInstallOnQuit,
      allowPrerelease: isPrereleaseAllowed(this.runtimeConfig, this.runtimeConfig.initialChannel),
      progress: null,
      checkedAt: null,
      downloadedAt: null,
      error: null,
    };
    this.updater = autoUpdater;
    this.configureLogger();
    this.configureUpdater();
  }

  public initialize(window: BrowserWindow): void {
    this.mainWindow = window;

    if (this.initialized) {
      this.emit("status");
      return;
    }

    this.registerUpdaterEvents();
    this.registerIpcHandlers();
    this.scheduleChecks();
    this.initialized = true;
    this.emit("status");
  }

  public getStatusSnapshot(): UpdaterState {
    return this.getStatus();
  }

  public cleanup(): void {
    this.clearTimers();
    // Preserve autoUpdater internals on app shutdown so
    // autoInstallOnAppQuit can finalize downloaded updates.

    if (this.ipcRegistered) {
      ipcMain.removeHandler(IPC_CHANNEL_CHECK);
      ipcMain.removeHandler(IPC_CHANNEL_DOWNLOAD);
      ipcMain.removeHandler(IPC_CHANNEL_INSTALL);
      ipcMain.removeHandler(IPC_CHANNEL_POSTPONE);
      ipcMain.removeHandler(IPC_CHANNEL_GET_STATUS);
      ipcMain.removeHandler(IPC_CHANNEL_SET_CHANNEL);
      ipcMain.removeHandler(IPC_CHANNEL_SET_AUTO_INSTALL);
      this.ipcRegistered = false;
    }

    this.mainWindow = null;
    this.initialized = false;
  }

  private configureLogger(): void {
    log.transports.file.level = "info";
    log.transports.console.level = "warn";
    this.updater.logger = log;
  }

  private configureUpdater(): void {
    // In dev (unpackaged), electron-updater skips checks unless this flag is enabled.
    // We already provide feed options dynamically via env, so we can safely force dev checks.
    this.updater.forceDevUpdateConfig = !app.isPackaged;
    this.updater.autoDownload = this.runtimeConfig.autoDownload;
    this.updater.autoInstallOnAppQuit = this.state.autoInstallOnQuit;
    this.updater.allowDowngrade = true;
    this.updater.allowPrerelease = this.state.allowPrerelease;
    // Differential download via blockmap is sensitive to stale CDN cache and
    // frequently causes checksum mismatch in self-hosted generic providers.
    // Force full installer download for reliability.
    (this.updater as AppUpdater & { disableDifferentialDownload?: boolean }).disableDifferentialDownload =
      true;

    const feedOptions = toFeedOptions(this.runtimeConfig, this.state.channel);
    if (!feedOptions) {
      this.updateState(
        {
          status: "error",
          error: "UPDATE_SERVER_URL not configured for generic provider.",
        },
        "error",
      );
      return;
    }

    try {
      if (this.runtimeConfig.provider === "generic") {
        this.updater.channel = getGenericProviderChannel(this.state.channel);
      }
      this.updater.setFeedURL(feedOptions as never);
      this.patchHttpExecutorDownloadProgress();
    } catch (error) {
      this.updateState(
        {
          status: "error",
          error: `Failed to configure update feed: ${safeErrorMessage(error)}`,
        },
        "error",
      );
    }
  }

  private patchHttpExecutorDownloadProgress(): void {
    if (this.httpExecutorPatched) {
      return;
    }

    const updaterWithInternals = this.updater as AppUpdater & {
      httpExecutor?: HttpExecutorLike;
      emit?: (eventName: string, payload: ProgressInfo) => boolean;
    };
    const httpExecutor = updaterWithInternals.httpExecutor;
    if (!httpExecutor || typeof httpExecutor.download !== "function") {
      return;
    }

    const originalDownload = httpExecutor.download.bind(httpExecutor);
    httpExecutor.download = async (downloadUrl, destinationFile, options) => {
      if (!this.isExpectedPackageDownload(downloadUrl)) {
        return originalDownload(downloadUrl, destinationFile, options);
      }

      const baseTransferred = this.expectedInstallerFileSize;
      const packageSize = this.expectedPackageFileSize;
      const totalSize = baseTransferred + packageSize;
      const emitAdjustedProgress = (progress: ProgressInfo) => {
        const resolvedPackageTotal = packageSize > 0 ? packageSize : toPositiveNumber(progress.total);
        const resolvedTotal = baseTransferred + resolvedPackageTotal;
        const adjustedTransferred = baseTransferred + toPositiveNumber(progress.transferred);
        const effectiveTransferred = resolvedTotal > 0
          ? Math.min(adjustedTransferred, resolvedTotal)
          : adjustedTransferred;
        const adjustedProgress: ProgressInfo = {
          ...progress,
          transferred: effectiveTransferred,
          total: resolvedTotal > 0 ? resolvedTotal : toPositiveNumber(progress.total),
          percent:
            resolvedTotal > 0
              ? (effectiveTransferred / resolvedTotal) * 100
              : progress.percent,
        };

        if (typeof options.onProgress === "function") {
          options.onProgress(adjustedProgress);
          return;
        }

        updaterWithInternals.emit?.("download-progress", adjustedProgress);
      };

      if (totalSize > 0) {
        emitAdjustedProgress({
          percent: 0,
          transferred: 0,
          total: packageSize,
          delta: 0,
          bytesPerSecond: 0,
        });
      }

      return originalDownload(downloadUrl, destinationFile, {
        ...options,
        onProgress: emitAdjustedProgress,
      });
    };

    this.httpExecutorPatched = true;
  }

  private isExpectedPackageDownload(downloadUrl: string | URL): boolean {
    const expectedPathIdentity = toPathIdentity(this.expectedPackagePath);
    const actualPathIdentity = toPathIdentity(downloadUrl);
    if (!expectedPathIdentity || !actualPathIdentity) {
      return false;
    }

    return (
      actualPathIdentity.full === expectedPathIdentity.full ||
      actualPathIdentity.base === expectedPathIdentity.base
    );
  }

  private registerUpdaterEvents(): void {
    this.updater.removeAllListeners();

    this.updater.on("checking-for-update", () => {
      if (
        this.state.status === "downloading" ||
        this.state.status === "downloaded" ||
        this.state.status === "available"
      ) {
        return;
      }
      this.updateState(
        {
          status: "checking",
          error: null,
          progress: null,
          checkedAt: Date.now(),
        },
        "checking",
      );
    });

    this.updater.on("update-available", (info: UpdateInfo) => {
      if (this.state.status === "downloading") {
        return;
      }
      const shouldAcceptVersion = this.allowChannelSwitchDownloadOnNextCheck
        ? normalizeVersionText(info.version) !== normalizeVersionText(this.state.currentVersion)
        : this.isRemoteVersionNewer(info.version);
      this.allowChannelSwitchDownloadOnNextCheck = false;
      if (!shouldAcceptVersion) {
        this.downloadedFileVerified = false;
        this.expectedInstallerFileSize = 0;
        this.expectedPackageFileSize = 0;
        this.expectedPackagePath = null;
        log.warn(
          `[updater] ignoring non-incremental release current=${this.state.currentVersion} remote=${info.version}`,
        );
        this.updateState(
          {
            status: "not-available",
            newVersion: null,
            mandatory: false,
            blocking: false,
            blockingReason: null,
            releaseNotes: null,
            progress: null,
            checkedAt: Date.now(),
            error: null,
          },
          "not-available",
        );
        return;
      }

      this.downloadedFileVerified = false;
      const mandatory = parseMandatoryFlag(info);
      const downloadMetadata = getUpdateDownloadMetadata(info);
      this.expectedInstallerFileSize = downloadMetadata.installerSize;
      this.expectedPackageFileSize = downloadMetadata.packageSize;
      this.expectedPackagePath = downloadMetadata.packagePath;
      this.updateState(
        {
          status: "available",
          newVersion: info.version,
          mandatory,
          blocking: mandatory,
          blockingReason: mandatory ? "mandatory-update" : null,
          releaseNotes: normalizeReleaseNotes(info.releaseNotes),
          checkedAt: Date.now(),
          progress: null,
          error: null,
        },
        "available",
      );
    });

    this.updater.on("update-not-available", () => {
      if (this.state.status === "downloading" || this.state.status === "downloaded") {
        return;
      }
      this.downloadedFileVerified = false;
      this.expectedInstallerFileSize = 0;
      this.expectedPackageFileSize = 0;
      this.expectedPackagePath = null;
      this.updateState(
        {
          status: "not-available",
          newVersion: null,
          mandatory: false,
          blocking: false,
          blockingReason: null,
          releaseNotes: null,
          progress: null,
          checkedAt: Date.now(),
          error: null,
        },
        "not-available",
      );
    });

    this.updater.on("download-progress", (progressInfo: ProgressInfo) => {
      let effectiveTransferred = toPositiveNumber(progressInfo.transferred);
      let effectiveTotal = toPositiveNumber(progressInfo.total);

      if (this.expectedPackageFileSize > 0 && effectiveTotal > 0 && effectiveTotal < this.expectedPackageFileSize) {
        this.expectedInstallerFileSize = Math.max(this.expectedInstallerFileSize, effectiveTotal);
        effectiveTotal = this.expectedInstallerFileSize + this.expectedPackageFileSize;
      } else if (effectiveTotal <= 0 && this.expectedPackageFileSize > 0) {
        effectiveTotal = this.expectedInstallerFileSize + this.expectedPackageFileSize;
      }

      const effectivePercent = effectiveTotal > 0
        ? (effectiveTransferred / effectiveTotal) * 100
        : progressInfo.percent;
      this.updateState(
        {
          status: "downloading",
          progress: {
            percent: effectivePercent,
            transferred: effectiveTransferred,
            total: effectiveTotal,
            speed: progressInfo.bytesPerSecond,
          },
          error: null,
        },
        "progress",
      );
    });

    this.updater.on("update-downloaded", (event: UpdateDownloadedEvent) => {
      void this.handleDownloadedEvent(event);
    });

    this.updater.on("error", (error) => {
      if (isMissingChannelManifestError(error)) {
        this.downloadedFileVerified = false;
        this.expectedInstallerFileSize = 0;
        this.expectedPackageFileSize = 0;
        this.expectedPackagePath = null;
        log.warn(
          `[updater] channel manifest missing for ${this.state.channel}; treating as no update available.`,
        );
        this.updateState(
          {
            status: "not-available",
            newVersion: null,
            mandatory: false,
            blocking: false,
            blockingReason: null,
            releaseNotes: null,
            progress: null,
            checkedAt: Date.now(),
            error: null,
          },
          "not-available",
        );
        return;
      }

      this.downloadedFileVerified = false;
      this.expectedInstallerFileSize = 0;
      this.expectedPackageFileSize = 0;
      this.expectedPackagePath = null;
      this.updateState(
        {
          status: "error",
          blocking: this.state.mandatory,
          blockingReason: this.state.mandatory ? "mandatory-update" : null,
          error: safeErrorMessage(error),
        },
        "error",
      );
    });
  }

  private isRemoteVersionNewer(remoteVersion: string): boolean {
    try {
      return this.updater.currentVersion.compare(remoteVersion) < 0;
    } catch (error) {
      log.warn(
        `[updater] unable to compare versions current=${this.state.currentVersion} remote=${remoteVersion}: ${safeErrorMessage(error)}`,
      );
      return false;
    }
  }

  private registerIpcHandlers(): void {
    if (this.ipcRegistered) {
      return;
    }

    ipcMain.handle(IPC_CHANNEL_CHECK, async (event) => {
      assertTrustedUpdaterSender(event, IPC_CHANNEL_CHECK);
      await this.checkForUpdates();
      return this.getStatus();
    });

    ipcMain.handle(IPC_CHANNEL_DOWNLOAD, async (event) => {
      assertTrustedUpdaterSender(event, IPC_CHANNEL_DOWNLOAD);
      await this.downloadUpdate();
      return this.getStatus();
    });

    ipcMain.removeHandler("updater:rollback");
    ipcMain.handle("updater:rollback", async (event) => {
      assertTrustedUpdaterSender(event, "updater:rollback");
      // electron-updater has no native rollback — return a typed error so the
      // UI can degrade gracefully (the current state is preserved).
      return {
        status: "error",
        error: "Rollback is not supported by this shell.",
      };
    });
    ipcMain.handle(IPC_CHANNEL_INSTALL, async (event) => {
      assertTrustedUpdaterSender(event, IPC_CHANNEL_INSTALL);
      this.installUpdate();
      return this.getStatus();
    });

    ipcMain.handle(IPC_CHANNEL_POSTPONE, (event) => {
      assertTrustedUpdaterSender(event, IPC_CHANNEL_POSTPONE);
      this.postpone();
      return this.getStatus();
    });

    ipcMain.handle(IPC_CHANNEL_GET_STATUS, (event) => {
      assertTrustedUpdaterSender(event, IPC_CHANNEL_GET_STATUS);
      return this.getStatus();
    });

    ipcMain.handle(IPC_CHANNEL_SET_CHANNEL, async (event, value: unknown) => {
      assertTrustedUpdaterSender(event, IPC_CHANNEL_SET_CHANNEL);
      await this.setChannel(toChannel(value));
      return this.getStatus();
    });

    ipcMain.handle(IPC_CHANNEL_SET_AUTO_INSTALL, (event, value: unknown) => {
      assertTrustedUpdaterSender(event, IPC_CHANNEL_SET_AUTO_INSTALL);
      this.setAutoInstallOnQuit(Boolean(value));
      return this.getStatus();
    });

    this.ipcRegistered = true;
  }

  private scheduleChecks(): void {
    this.clearTimers();
    this.delayedCheckTimer = setTimeout(() => {
      void this.checkForUpdates();
    }, CHECK_DELAY_MS);
    this.periodicCheckTimer = setInterval(() => {
      void this.checkForUpdates();
    }, PERIODIC_CHECK_MS);
  }

  private clearTimers(): void {
    if (this.delayedCheckTimer) {
      clearTimeout(this.delayedCheckTimer);
      this.delayedCheckTimer = null;
    }
    if (this.periodicCheckTimer) {
      clearInterval(this.periodicCheckTimer);
      this.periodicCheckTimer = null;
    }
  }

  private async checkForUpdates(): Promise<void> {
    if (!this.runtimeConfig.initialEnabled) {
      return;
    }

    if (this.state.status === "downloading" || this.state.status === "downloaded") {
      return;
    }

    if (this.checkInFlight) {
      await this.checkInFlight;
      return;
    }

    this.checkInFlight = (async () => {
      try {
        await this.updater.checkForUpdates();
      } catch (error) {
        if (isMissingChannelManifestError(error)) {
          this.downloadedFileVerified = false;
          this.expectedInstallerFileSize = 0;
          this.expectedPackageFileSize = 0;
          this.expectedPackagePath = null;
          log.warn(
            `[updater] channel manifest missing for ${this.state.channel}; treating as no update available.`,
          );
          this.updateState(
            {
              status: "not-available",
              newVersion: null,
              releaseNotes: null,
              progress: null,
              checkedAt: Date.now(),
              error: null,
            },
            "not-available",
          );
          return;
        }

        this.updateState(
          {
            status: "error",
            error: `Failed to check for updates: ${safeErrorMessage(error)}`,
          },
          "error",
        );
      }
    })();

    try {
      await this.checkInFlight;
    } finally {
      this.checkInFlight = null;
    }
  }

  private async downloadUpdate(): Promise<void> {
    if (!this.runtimeConfig.initialEnabled) {
      this.updateState(
        {
          status: "error",
          blocking: this.state.mandatory,
          blockingReason: this.state.mandatory ? "mandatory-update" : null,
          error: "Updater disabled by the current configuration.",
        },
        "error",
      );
      return;
    }

    if (this.checkInFlight) {
      try {
        await this.checkInFlight;
      } catch {
        // Fall through: updater state below decides whether download may continue.
      }
    }

    if (this.downloadInFlight) {
      await this.downloadInFlight;
      return;
    }

    if (this.state.status !== "available" && this.state.status !== "downloading") {
      this.updateState(
        {
          status: "error",
          blocking: this.state.mandatory,
          blockingReason: this.state.mandatory ? "mandatory-update" : null,
          error: "No update available for download right now.",
        },
        "error",
      );
      return;
    }

    this.updateState(
      {
        status: "downloading",
        blocking: this.state.mandatory,
        blockingReason: this.state.mandatory ? "mandatory-update" : null,
        progress:
          this.state.progress ??
          ({
            percent: 0,
            transferred: 0,
            total: this.expectedInstallerFileSize + this.expectedPackageFileSize,
            speed: 0,
          } as UpdaterState["progress"]),
        error: null,
      },
      "progress",
    );

    log.info(
      `[updater] download requested version=${this.state.newVersion ?? "unknown"} provider=${this.state.provider}`,
    );

    this.downloadInFlight = (async () => {
      try {
        const files = await this.updater.downloadUpdate();
        log.info(
          `[updater] download finished files=${Array.isArray(files) ? files.join(",") : String(files)}`,
        );
      } catch (error) {
        const message = safeErrorMessage(error);
        const maybeChecksumMismatch = /sha512 checksum mismatch/i.test(message);
        log.error(`[updater] download failed: ${message}`);
        this.updateState(
          {
            status: "error",
            blocking: this.state.mandatory,
            blockingReason: this.state.mandatory ? "mandatory-update" : null,
            error: maybeChecksumMismatch
              ? "Failed to download update: sha512 checksum mismatch. Check manifest/file synchronization on the VPS, clear the CDN cache (Cloudflare), then publish a new version."
              : `Failed to download update: ${message}`,
          },
          "error",
        );
      }
    })();

    try {
      await this.downloadInFlight;
    } finally {
      this.downloadInFlight = null;
    }
  }

  private installUpdate(): void {
    if (!this.downloadedFileVerified || this.state.status !== "downloaded") {
      this.updateState(
        {
          status: "error",
          blocking: this.state.mandatory,
          blockingReason: this.state.mandatory ? "mandatory-update" : null,
          error: "The update has not been downloaded and verified yet.",
        },
        "error",
      );
      return;
    }

    this.updater.quitAndInstall(false, true);
  }

  private postpone(): void {
    if (this.state.blocking) {
      this.updateState(
        {
          status: this.state.status === "downloaded" ? "downloaded" : "available",
          error: "This update is mandatory. Download and install it to continue.",
        },
        "status",
      );
      return;
    }

    this.updateState(
      {
        status: "idle",
        mandatory: false,
        blocking: false,
        blockingReason: null,
        error: null,
        progress: null,
      },
      "status",
    );
  }

  private async setChannel(channel: UpdateChannel): Promise<void> {
    if (this.state.channel === channel) {
      return;
    }

    const pendingCheck = this.checkInFlight;
    this.state.channel = channel;
    this.state.allowPrerelease = isPrereleaseAllowed(this.runtimeConfig, channel);
    this.allowChannelSwitchDownloadOnNextCheck = true;
    this.configureUpdater();
    this.emit("status");

    if (pendingCheck) {
      try {
        await pendingCheck;
      } catch {
        // A channel switch should always force a fresh check below.
      }
    }

    await this.checkForUpdates();
  }

  private setAutoInstallOnQuit(enabled: boolean): void {
    this.state.autoInstallOnQuit = enabled;
    this.updater.autoInstallOnAppQuit = enabled;
    this.emit("status");
  }

  private async handleDownloadedEvent(event: UpdateDownloadedEvent): Promise<void> {
    try {
      await this.verifyDownloadIntegrity(event);
      this.downloadedFileVerified = true;
      this.updater.autoInstallOnAppQuit = this.state.autoInstallOnQuit;
      this.updateState(
        {
          status: "downloaded",
          newVersion: event.version,
          mandatory: this.state.mandatory,
          blocking: this.state.mandatory,
          blockingReason: this.state.mandatory ? "mandatory-update" : null,
          releaseNotes: normalizeReleaseNotes(event.releaseNotes),
          downloadedAt: Date.now(),
          error: null,
          progress: {
            percent: 100,
            transferred: this.state.progress?.transferred ?? 0,
            total:
              this.state.progress?.total ??
              this.expectedInstallerFileSize + this.expectedPackageFileSize,
            speed: this.state.progress?.speed ?? 0,
          },
        },
        "downloaded",
      );
    } catch (error) {
      this.downloadedFileVerified = false;
      this.updateState(
        {
          status: "error",
          blocking: this.state.mandatory,
          blockingReason: this.state.mandatory ? "mandatory-update" : null,
          error: `SHA-512 validation failed for update: ${safeErrorMessage(error)}`,
        },
        "error",
      );
    }
  }

  private async verifyDownloadIntegrity(event: UpdateDownloadedEvent): Promise<void> {
    const downloadedFileName = path.basename(event.downloadedFile);
    const fileInfo =
      event.files.find((file) => {
        const rawUrl = String((file as { url?: unknown }).url ?? "");
        let parsedPath = rawUrl;
        if (rawUrl.includes("://")) {
          try {
            parsedPath = new URL(rawUrl).pathname;
          } catch {
            parsedPath = rawUrl;
          }
        }
        return path.basename(parsedPath) === downloadedFileName;
      }) ??
      event.files[0];

    const expectedSha512 = fileInfo?.sha512 ? normalizeSha512(fileInfo.sha512) : null;
    if (!expectedSha512) {
      throw new Error("Expected SHA-512 hash not found in the release metadata.");
    }

    const currentSha512 = normalizeSha512(await computeFileSha512(event.downloadedFile));
    if (currentSha512 !== expectedSha512) {
      throw new Error("SHA-512 checksum mismatch.");
    }
  }

  private getStatus(): UpdaterState {
    return {
      ...this.state,
      progress: this.state.progress ? { ...this.state.progress } : null,
    };
  }

  private updateState(partialState: Partial<UpdaterState>, event: UpdaterEventName): void {
    Object.assign(this.state, partialState);
    this.emit(event);
  }

  private emit(event: UpdaterEventName): void {
    const payload: UpdaterEventPayload = {
      event,
      state: this.getStatus(),
    };

    try {
      this.mainWindow?.webContents.send(IPC_CHANNEL_EVENT, payload);
    } catch {
      // Event dispatch failure must never crash desktop runtime.
    }
  }
}
