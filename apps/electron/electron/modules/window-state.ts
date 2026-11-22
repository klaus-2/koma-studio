import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface WindowStateBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowState {
  bounds: WindowStateBounds;
  maximized: boolean;
}

export const WINDOW_STATE_FILENAME = "window-state.json";

export const getWindowStateFilePath = (userDataPath: string): string =>
  path.join(userDataPath, WINDOW_STATE_FILENAME);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const parseBounds = (value: unknown): WindowStateBounds | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    !isFiniteNumber(record.x) ||
    !isFiniteNumber(record.y) ||
    !isFiniteNumber(record.width) ||
    !isFiniteNumber(record.height)
  ) {
    return null;
  }
  if (record.width <= 0 || record.height <= 0) {
    return null;
  }
  return { x: record.x, y: record.y, width: record.width, height: record.height };
};

export const parseWindowStatePayload = (value: unknown): WindowState | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const bounds = parseBounds(record.bounds);
  if (!bounds) {
    return null;
  }
  return { bounds, maximized: record.maximized === true };
};

export const readWindowStateFile = (userDataPath: string): WindowState | null => {
  try {
    return parseWindowStatePayload(
      JSON.parse(fs.readFileSync(getWindowStateFilePath(userDataPath), "utf-8")),
    );
  } catch (error) {
    if (
      !(
        error instanceof Error &&
        "code" in error &&
        typeof error.code === "string" &&
        error.code === "ENOENT"
      )
    ) {
      console.warn("[window-state] failed to read the window state file:", error);
    }
    return null;
  }
};

export const writeWindowStateFile = (
  userDataPath: string,
  state: WindowState,
): void => {
  const filePath = getWindowStateFilePath(userDataPath);
  const tempPath = `${filePath}.${randomUUID()}.tmp`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(tempPath, JSON.stringify(state));
  fs.renameSync(tempPath, filePath);
};

const clampNumber = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export const clampBoundsIntoWorkArea = (
  bounds: WindowStateBounds,
  workArea: WindowStateBounds,
): WindowStateBounds => {
  const width = Math.min(bounds.width, workArea.width);
  const height = Math.min(bounds.height, workArea.height);
  return {
    width,
    height,
    x: clampNumber(bounds.x, workArea.x, workArea.x + workArea.width - width),
    y: clampNumber(bounds.y, workArea.y, workArea.y + workArea.height - height),
  };
};

export interface RestoredWindowPlacement {
  bounds: WindowStateBounds;
  maximized: boolean;
}

export interface BrowserWindowPlacementOptions {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
}

const DEFAULT_WINDOW_WIDTH = 1280;
const DEFAULT_WINDOW_HEIGHT = 860;

export const restoredBrowserWindowOptions = (
  placement: RestoredWindowPlacement | null,
): BrowserWindowPlacementOptions =>
  placement
    ? {
        width: placement.bounds.width,
        height: placement.bounds.height,
        x: placement.bounds.x,
        y: placement.bounds.y,
      }
    : { width: DEFAULT_WINDOW_WIDTH, height: DEFAULT_WINDOW_HEIGHT };

export interface DisplayWorkAreaFinder {
  getDisplayMatching(bounds: WindowStateBounds): { workArea: WindowStateBounds };
}

export const resolveRestoredPlacement = (
  userDataPath: string,
  finder: DisplayWorkAreaFinder,
): RestoredWindowPlacement | null => {
  const saved = readWindowStateFile(userDataPath);
  if (!saved) {
    return null;
  }
  const matchingDisplay = finder.getDisplayMatching(saved.bounds);
  return {
    bounds: clampBoundsIntoWorkArea(saved.bounds, matchingDisplay.workArea),
    maximized: saved.maximized,
  };
};

interface PersistableMainWindow {
  isDestroyed(): boolean;
  getNormalBounds(): WindowStateBounds;
  isMaximized(): boolean;
  on(event: "close", listener: () => void): unknown;
}

export const persistWindowBoundsOnClose = (
  window: PersistableMainWindow,
  userDataPath: string,
): void => {
  window.on("close", () => {
    if (window.isDestroyed()) {
      return;
    }
    try {
      writeWindowStateFile(userDataPath, {
        bounds: window.getNormalBounds(),
        maximized: window.isMaximized(),
      });
    } catch (error) {
      console.warn("[window-state] failed to save the window state:", error);
    }
  });
};
