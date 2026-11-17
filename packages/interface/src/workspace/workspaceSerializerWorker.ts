/// <reference lib="webworker" />

import type {
  WireCaptureState,
  WirePageFile,
  WorkspaceSerializeError,
  WorkspaceSerializeRequest,
  WorkspaceSerializeResponse,
  WorkspaceSerializeSuccess,
} from './workspaceSerializerJob';
import type { DashboardWorkspaceCaptureState } from './dashboardWorkspace';
import { captureWorkspaceDocument } from './dashboardWorkspace.serialization';
import {
  buildWorkspaceAutosaveSignature,
  buildWorkspaceHistorySignature,
} from './dashboardWorkspace.signature';
import {
  createArchivePageFile,
  createDirectPageFile,
  type PageFile,
} from '../utils/page-source';

/**
 * Narrow message scope of the serializer worker (the async `FileSystem`-free
 * slice of DedicatedWorkerGlobalScope this entry uses). Declared module-locally
 * so the DOM-lib `self` typing does not leak `window.postMessage` into the
 * worker entry.
 */
interface WorkerMessageScope {
  postMessage(message: WorkspaceSerializeResponse, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<WorkspaceSerializeRequest>) => void) | null;
}

declare const self: WorkerMessageScope;

let messageTarget: WorkerMessageScope = self;

export const attachWorkerScopeForTest = (scope: WorkerMessageScope | null): void => {
  messageTarget = scope ?? self;
  messageTarget.onmessage = handleWorkerMessage;
};

const rehydratePageFile = (file: WirePageFile): PageFile => {
  if (file.kind === 'direct') {
    return createDirectPageFile(file.resident);
  }
  const page = createArchivePageFile(file.chapter, file.entry, file.name, file.type);
  // The archive placeholder stamps Date.now(); lastModified is a signature
  // input, so the rehydrated page restores the original value.
  return { ...page, lastModified: file.lastModified };
};

const rehydrateCaptureState = (wire: WireCaptureState): DashboardWorkspaceCaptureState => ({
  ...wire,
  images: wire.images.map((image) => ({
    ...image,
    file: rehydratePageFile(image.file),
  })),
});

const handleSerializeRequest = async (request: WorkspaceSerializeRequest): Promise<void> => {
  try {
    const state = rehydrateCaptureState(request.state);
    const payload = await captureWorkspaceDocument(state);
    const autosaveSignature = buildWorkspaceAutosaveSignature(state);
    const historySignature = buildWorkspaceHistorySignature(state);
    const response: WorkspaceSerializeSuccess = {
      kind: 'serialize-success',
      id: request.id,
      payload,
      autosaveSignature,
      historySignature,
    };
    messageTarget.postMessage(
      response,
      payload.assets.map((asset) => asset.buffer),
    );
  } catch (error) {
    const response: WorkspaceSerializeError = {
      kind: 'serialize-error',
      id: request.id,
      message: error instanceof Error
        ? error.message
        : 'Workspace serialization failed in the worker.',
    };
    messageTarget.postMessage(response);
  }
};

function handleWorkerMessage(event: MessageEvent<WorkspaceSerializeRequest>): void {
  const request = event.data;
  if (request.kind !== 'serialize') return;
  void handleSerializeRequest(request);
}

messageTarget.onmessage = handleWorkerMessage;
