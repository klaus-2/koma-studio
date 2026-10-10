import { writable } from "svelte/store";
import type { ProgressEvent, BuildResult, TabId } from "./types";

export const activeTab = writable<TabId>("build");
export const isRunning = writable(false);
export const progress = writable(0);
export const progressPhase = writable("");
export const logs = writable<ProgressEvent[]>([]);
export const lastResult = writable<BuildResult | null>(null);


export function clearLogs() {
  logs.set([]);
  progress.set(0);
  progressPhase.set("");
  lastResult.set(null);
}

export function addLog(ev: ProgressEvent) {
  logs.update((l) => [...l, ev]);
  if (ev.pct > 0) {
    progress.set(ev.pct);
  }
  if (ev.phase) {
    progressPhase.set(ev.phase);
  }
}
