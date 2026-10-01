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
    // Cold cuDNN/CUDA warmup on the legacy profile is measured at ~151s
    // (model_loaded at +145s, warmup.done at +151s). 360s gives ~2.4x margin
    // over the worst observed cold start; warm OS-file-cache runs stay ~90s.
    return {
      initial: { attempts: 720, delayMs: 500 },
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
