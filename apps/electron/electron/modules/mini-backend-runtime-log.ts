/**
 * Mini-backend runtime stdout/stderr ring buffer.
 */

interface MiniBackendRuntimeLogEntry {
  timestamp: string;
  stream: "stdout" | "stderr";
  message: string;
}

interface MiniBackendRuntimeLogBuffer {
  push: (stream: "stdout" | "stderr", chunkText: string) => void;
  /** Live array reference — consumers snapshot at read time. */
  getEntries: () => MiniBackendRuntimeLogEntry[];
}

const createMiniBackendRuntimeLogBuffer = (limit: number): MiniBackendRuntimeLogBuffer => {
  let buffer: MiniBackendRuntimeLogEntry[] = [];

  const push = (stream: "stdout" | "stderr", chunkText: string): void => {
    const lines = chunkText
      .replace(/\r/g, "\n")
      .split("\n")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, 120);

    if (lines.length === 0) {
      return;
    }

    const timestamp = new Date().toISOString();
    for (const line of lines) {
      buffer.push({
        timestamp,
        stream,
        message: line.slice(0, 2_000),
      });
    }

    if (buffer.length > limit) {
      buffer = buffer.slice(buffer.length - limit);
    }
  };

  return {
    push,
    getEntries: () => buffer,
  };
};

export type { MiniBackendRuntimeLogBuffer, MiniBackendRuntimeLogEntry };
export { createMiniBackendRuntimeLogBuffer };
