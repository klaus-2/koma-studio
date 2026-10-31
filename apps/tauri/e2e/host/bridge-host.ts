import type { Page } from "@playwright/test";

import { desktopCommandChannels } from "../../../../packages/types/src/desktop-api.ts";

import {
  isE2eModelDownloadPayload,
  ModelHandlers,
} from "./handlers.models.ts";
import { userId, WorkspaceHandlers } from "./handlers.workspace.ts";
import { stubHandlers } from "./stubs.ts";

const channels = desktopCommandChannels;

export interface BridgeHostOptions {
  runRoot: string;
  backendUrl: string;
  page: Page;
}

export type CommandHandler = (args: Record<string, unknown>) => unknown;

const buildCommandHandlers = (
  models: ModelHandlers,
  workspace: WorkspaceHandlers,
): Map<string, CommandHandler> =>
  new Map<string, CommandHandler>([
    ...Object.entries(stubHandlers),

    // models
    [channels.models.listInstalled, () => models.listInstalled()],
    [channels.models.getDiskSpace, () => models.getDiskSpace()],
    [channels.models.checkUpdates, () => []],
    [channels.models.download, (args) => {
      const payload: unknown = args.payload;
      if (!isE2eModelDownloadPayload(payload)) {
        throw new Error("E2E_MODEL_PAYLOAD_INVALID");
      }
      return models.download(payload);
    }],
    [channels.models.importOnnx, () => {
      throw new Error("E2E_UNMOCKED_COMMAND: model ONNX import is not used");
    }],
    [channels.models.cancel, (args) => models.cancel(String(args.modelId ?? ""))],
    [channels.models.cancelAll, () => models.cancelAll()],
    [channels.models.uninstall, (args) => models.uninstall(String(args.modelId ?? ""))],

    // workspace + files
    [channels.workspace.loadAutosave, (args) =>
      workspace.loadAutosave(userId(args.userId))],
    [channels.workspace.saveAutosave, (args) =>
      workspace.saveAutosave(userId(args.userId), args.payload)],
    [channels.workspace.clearAutosave, (args) =>
      workspace.clearAutosave(userId(args.userId))],
    [channels.workspace.exportCurrent, (args) =>
      workspace.exportCurrent(
        String(args.defaultFileName ?? "workspace.koma"),
        args.payload,
      )],
    [channels.files.saveBlob, (args) =>
      workspace.saveBlob(
        String(args.defaultFileName ?? "export.bin"),
        String(args.dataBase64 ?? ""),
      )],
  ]);

/**
 * Composition root for the in-browser desktop bridge double: it owns the
 * channel registry and dispatch, while the domain handler classes live in
 * handlers.models.ts / handlers.workspace.ts and stubs.ts.
 */
export class E2eBridgeHost {
  private readonly handlers: Map<string, CommandHandler>;

  constructor(options: BridgeHostOptions) {
    const models = new ModelHandlers({
      runRoot: options.runRoot,
      backendUrl: options.backendUrl.replace(/\/+$/, ""),
      page: options.page,
    });
    const workspace = new WorkspaceHandlers({ runRoot: options.runRoot });
    this.handlers = buildCommandHandlers(models, workspace);
  }

  async handle(channel: string, args: Record<string, unknown>): Promise<unknown> {
    if (channel.startsWith("desktop-models:")) {
      process.stdout.write(`[host] ${channel}\n`);
    }
    const handler = this.handlers.get(channel);
    if (handler) return handler(args);
    // Activity-only Discord RPC channels are safe to no-op; the connection
    // stubs above already report the feature as disabled.
    if (channel.startsWith("discord-rpc:")) return undefined;
    throw new Error(`E2E_UNMOCKED_COMMAND: ${channel}`);
  }
}
