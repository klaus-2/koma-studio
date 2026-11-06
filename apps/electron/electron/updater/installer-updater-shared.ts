import type {
  UpdaterChannel,
  UpdaterEventName,
  UpdaterProgress,
  UpdaterStatusPayload,
} from "../../../../packages/types/src/desktop-events.ts";

export const normalizeUpdaterReleaseNotes = (notes: unknown): string | null => {
  if (typeof notes === "string") {
    const trimmed = notes.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (Array.isArray(notes)) {
    const joined = notes
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }
        const note = (entry as Record<string, unknown>).note;
        return typeof note === "string" && note.trim().length > 0 ? note.trim() : null;
      })
      .filter((note): note is string => note !== null)
      .join("\n\n");
    return joined.length > 0 ? joined : null;
  }
  return null;
};

export const createInitialUpdaterState = (
  currentVersion: string,
): UpdaterStatusPayload => ({
  status: "idle",
  currentVersion,
  newVersion: null,
  mandatory: false,
  blocking: false,
  blockingReason: null,
  releaseNotes: null,
  channel: "stable",
  provider: "github",
  autoInstallOnQuit: true,
  allowPrerelease: false,
  progress: null,
  checkedAt: null,
  downloadedAt: null,
  error: null,
});

export interface UpdaterChannelConfig {
  allowPrerelease: boolean;
  electronChannel: string;
  allowDowngrade: boolean;
}

export const updaterChannelConfig = (
  channel: UpdaterChannel,
): UpdaterChannelConfig =>
  channel === "beta"
    ? { allowPrerelease: true, electronChannel: "beta", allowDowngrade: false }
    : { allowPrerelease: false, electronChannel: "latest", allowDowngrade: false };

export type UpdaterTransition =
  | { type: "checking" }
  | { type: "available"; version: string; releaseNotes: string | null; checkedAt: number }
  | { type: "not-available"; checkedAt: number }
  | { type: "progress"; progress: UpdaterProgress }
  | { type: "downloaded"; downloadedAt: number }
  | { type: "error"; message: string };

export const updaterTransitionEventName = (
  transition: UpdaterTransition,
): UpdaterEventName => transition.type;

export const applyUpdaterTransition = (
  previous: UpdaterStatusPayload,
  transition: UpdaterTransition,
  channel: UpdaterChannel,
): UpdaterStatusPayload => {
  const status: UpdaterStatusPayload["status"] =
    transition.type === "progress" ? "downloading" : transition.type;
  const next: UpdaterStatusPayload = {
    ...previous,
    status,
    channel,
    allowPrerelease: channel === "beta",
    currentVersion: previous.currentVersion,
  };

  switch (transition.type) {
    case "checking":
      next.progress = null;
      next.error = null;
      next.downloadedAt = null;
      break;
    case "available":
      next.newVersion = transition.version;
      next.releaseNotes = transition.releaseNotes;
      next.checkedAt = transition.checkedAt;
      next.progress = null;
      next.error = null;
      next.downloadedAt = null;
      break;
    case "not-available":
      next.checkedAt = transition.checkedAt;
      next.progress = null;
      next.error = null;
      next.downloadedAt = null;
      break;
    case "progress":
      next.progress = transition.progress;
      break;
    case "downloaded":
      next.downloadedAt = transition.downloadedAt;
      break;
    case "error":
      next.error = transition.message;
      break;
  }

  return next;
};
