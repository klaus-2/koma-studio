export type RuntimeStartupSource = "bundled-core" | "downloaded-runtime";

export interface MiniBackendStartupWaitOptions {
  attempts: number;
  delayMs: number;
}

export interface MiniBackendStartupPolicy {
  initial: MiniBackendStartupWaitOptions;
  background: MiniBackendStartupWaitOptions | null;
}

export const resolveMiniBackendStartupPolicy = ({
  isDev,
  source,
}: {
  isDev: boolean;
  source: RuntimeStartupSource;
}): MiniBackendStartupPolicy => {
  if (isDev) {
    return {
      initial: { attempts: 240, delayMs: 500 },
      background: null,
    };
  }

  if (source === "downloaded-runtime") {
    return {
      initial: { attempts: 600, delayMs: 1_000 },
      background: null,
    };
  }

  return {
    initial: { attempts: 60, delayMs: 500 },
    background: null,
  };
};
