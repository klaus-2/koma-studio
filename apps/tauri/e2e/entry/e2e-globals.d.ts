import type { ModelManagerEvent } from "@shared/desktop-events";
import type { KomaE2EStateBridge } from "./e2e-state";

declare global {
  interface Window {
    __komaE2E?: KomaE2EStateBridge;
    __komaE2EHostCall?: <T>(
      channel: string,
      args: Record<string, unknown>,
    ) => Promise<T>;
    __e2eDispatchModelEvent?: (event: ModelManagerEvent) => void;
    __e2eChannels?: string[];
  }
}

export {};
