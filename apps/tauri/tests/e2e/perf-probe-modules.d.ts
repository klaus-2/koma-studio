interface PerfLongTaskEntry {
  readonly duration: number;
  readonly startTime: number;
}

interface PerfFrameEntry {
  readonly start: number;
  readonly duration: number;
}

interface Window {
  __komaPerfLongTasks?: PerfLongTaskEntry[];
  __komaPerfFrames?: PerfFrameEntry[];
}
