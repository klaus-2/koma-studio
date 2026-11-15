import { desktopBridge } from "./desktop-bridge";

/**
 * Whether the running shell exposes the native open-logs-folder command.
 * Web-only builds hide the action entirely (honest fallback).
 */
export function canOpenLogsFolder(): boolean {
  return desktopBridge.isDesktopRuntime() && desktopBridge.desktop?.diagnostics !== undefined;
}

/**
 * Reveals the mini-backend logs folder in the OS file manager. Resolves to
 * `false` when the shell reports a failed reveal (or when no shell exists).
 */
export async function openLogsFolder(): Promise<boolean> {
  const result = await desktopBridge.desktop?.diagnostics?.openLogsFolder();
  return result?.opened ?? false;
}
