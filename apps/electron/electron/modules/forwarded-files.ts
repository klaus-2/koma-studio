import fs from "node:fs";
import path from "node:path";

const FORWARDED_FILE_EXTENSIONS: ReadonlySet<string> = new Set([
  ".zip",
  ".cbz",
  ".cb7",
  ".pdf",
  ".psd",
]);

export const FORWARDED_FILES_EVENT_CHANNEL = "desktop:files:forwarded";

const hasForwardedFileExtension = (filePath: string): boolean =>
  FORWARDED_FILE_EXTENSIONS.has(path.extname(filePath).toLowerCase());

const isExistingFile = (filePath: string): boolean => {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
};

export const extractForwardedFilePaths = (argv: string[]): string[] => {
  const forwardedPaths: string[] = [];
  const seenPaths = new Set<string>();

  argv.forEach((argument) => {
    if (typeof argument !== "string" || !hasForwardedFileExtension(argument)) {
      return;
    }
    if (!path.isAbsolute(argument) || !isExistingFile(argument)) {
      return;
    }
    const resolvedPath = path.resolve(argument);
    if (seenPaths.has(resolvedPath)) {
      return;
    }
    seenPaths.add(resolvedPath);
    forwardedPaths.push(resolvedPath);
  });

  return forwardedPaths;
};

const normalizeForwardedPath = (filePath: string): string => filePath.trim();

const stagedForwardedFilePaths = new Set<string>();

export const recordForwardedFilePaths = (filePaths: readonly string[]): void => {
  for (const filePath of filePaths) {
    stagedForwardedFilePaths.add(normalizeForwardedPath(filePath));
  }
};

export const isForwardedFilePathStaged = (filePath: string): boolean =>
  stagedForwardedFilePaths.has(normalizeForwardedPath(filePath));

export const extractPendingForwardedFilePaths = (argv: string[]): string[] | null => {
  const paths = extractForwardedFilePaths(argv);
  return paths.length > 0 ? paths : null;
};

interface ForwardTargetWindow {
  isDestroyed(): boolean;
  webContents: { send(channel: string, payload: unknown): void };
}

export const forwardFilesToRenderer = (
  window: ForwardTargetWindow | null,
  filePaths: string[],
): void => {
  if (!window || window.isDestroyed()) {
    return;
  }
  recordForwardedFilePaths(filePaths);
  window.webContents.send(FORWARDED_FILES_EVENT_CHANNEL, { paths: filePaths });
};

export interface OpenFileForwardingDeps {
  getMainWindow(): ForwardTargetWindow | null;
  appendPendingForwardedPaths(paths: string[]): void;
}

interface OpenFileAwareApp {
  on(
    event: "open-file",
    listener: (event: { preventDefault(): void }, filePath: string) => void,
  ): unknown;
}

export const registerOpenFileForwarding = (
  app: OpenFileAwareApp,
  deps: OpenFileForwardingDeps,
): void => {
  app.on("open-file", (event, filePath) => {
    const forwardedPaths = extractForwardedFilePaths([filePath]);
    if (forwardedPaths.length === 0) {
      return;
    }
    event.preventDefault();
    const mainWindow = deps.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      forwardFilesToRenderer(mainWindow, forwardedPaths);
      return;
    }
    deps.appendPendingForwardedPaths(forwardedPaths);
  });
};
