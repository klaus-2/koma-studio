import { desktopBridge } from "@/lib/desktop-bridge";
import type { IDesktopBridge } from "@shared/desktop-api";

import { inferMimeTypeFromFileName } from "../../../utils/dashboard.utils";

export interface ForwardedFilesIngestionDeps {
  onDrop: (files: File[]) => void | Promise<void>;
  setStatusMessage: (message: string) => void;
}

type ForwardedFilesIngestion = (paths: string[]) => void;

let pendingPaths: string[] = [];
let ingestion: ForwardedFilesIngestion | null = null;
let subscriptionInstalled = false;

const sanitizeForwardedPaths = (paths: readonly string[]): string[] => {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const path of paths) {
    const trimmed = path.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    unique.push(trimmed);
  }
  return unique;
};

const dispatchForwardedPaths = (paths: string[]): void => {
  if (paths.length === 0) {
    return;
  }
  if (ingestion) {
    ingestion(paths);
    return;
  }
  pendingPaths = [...pendingPaths, ...paths];
};

export const installForwardedFilesSubscription = (): void => {
  if (subscriptionInstalled) {
    return;
  }
  const bridge = desktopBridge.desktop;
  if (!bridge?.onForwardedFiles) {
    return;
  }
  subscriptionInstalled = true;
  bridge.onForwardedFiles((payload) => {
    dispatchForwardedPaths(sanitizeForwardedPaths(payload.paths));
  });
};

export const setForwardedFilesIngestion = (
  handler: ForwardedFilesIngestion | null,
): void => {
  ingestion = handler;
  if (!handler || pendingPaths.length === 0) {
    return;
  }
  const drained = pendingPaths;
  pendingPaths = [];
  handler(drained);
};

const forwardedFileName = (path: string): string => {
  const normalized = path.replace(/\\/g, "/");
  const name = normalized.slice(normalized.lastIndexOf("/") + 1).trim();
  return name || path;
};

const readForwardedFile = async (
  path: string,
  bridge: IDesktopBridge,
): Promise<File | null> => {
  if (!bridge.files.readForwarded) {
    return null;
  }
  const { data } = await bridge.files.readForwarded({ path });
  const name = forwardedFileName(path);
  return new File([data], name, {
    type: inferMimeTypeFromFileName(name),
  });
};

export const ingestForwardedFilePaths = async (
  paths: string[],
  deps: ForwardedFilesIngestionDeps,
): Promise<void> => {
  if (paths.length === 0) {
    return;
  }
  const bridge = desktopBridge.desktop;
  const files: File[] = [];
  const rejected: string[] = [];

  for (const path of paths) {
    try {
      const file = bridge ? await readForwardedFile(path, bridge) : null;
      if (file) {
        files.push(file);
      } else {
        rejected.push(forwardedFileName(path));
      }
    } catch (error) {
      rejected.push(forwardedFileName(path));
      bridge
        ?.sessionLog({
          level: 'warn',
          source: 'renderer',
          message: `forwarded file "${path}" could not be read: ${error instanceof Error ? error.message : String(error)}`,
        })
        ?.catch(() => undefined);
    }
  }

  if (files.length > 0) {
    await deps.onDrop(files);
  }
  if (rejected.length > 0) {
    const suffix = rejected.length > 3 ? "..." : "";
    deps.setStatusMessage(
      `${rejected.length} file(s) received from the OS could not be opened (${rejected.slice(0, 3).join(", ")}${suffix}). Import them through the upload area.`,
    );
  }
};
