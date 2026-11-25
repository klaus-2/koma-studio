import { invoke } from "@tauri-apps/api/core";
import type { InvokeArgs, InvokeOptions } from "@tauri-apps/api/core";
import type { DesktopCommandName } from "@shared/desktop-api";

import { toBridgeRejectionError } from "./bridge-rejection";

export type TauriCommandName = DesktopCommandName;
export type TauriCommandArgs = InvokeArgs | undefined;

export const invokeCommand = <TResponse = unknown>(
  command: TauriCommandName,
  args?: TauriCommandArgs,
  options?: InvokeOptions,
): Promise<TResponse> => {
  const pending =
    options !== undefined
      ? invoke<TResponse>(command, args, options)
      : args !== undefined
        ? invoke<TResponse>(command, args)
        : invoke<TResponse>(command);

  return pending.catch((rejection: unknown) => {
    throw toBridgeRejectionError(rejection);
  });
};
