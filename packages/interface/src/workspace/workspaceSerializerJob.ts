import type { WorkspacePackagePayload } from "../../../../packages/types/src/workspace";
import type { LoadedImage } from "../types/dashboard.types";
import type { ArchiveChapter, ArchiveEntryMeta } from "../utils/archive-chapter-reader";
import type { PageFile } from "../utils/page-source";
import type { DashboardWorkspaceCaptureState } from "./dashboardWorkspace";
import { captureWorkspaceDocument } from "./dashboardWorkspace.serialization";
import {
  buildWorkspaceAutosaveSignature,
  buildWorkspaceHistorySignature,
} from "./dashboardWorkspace.signature";

/**
 * Wire shape of a PageFile for the serializer worker. `PageFile` objects carry
 * function properties (`toBlob`/`dimensions`/`release`) which structured clone
 * rejects, so the page travels as a descriptor and the worker rehydrates it:
 * direct pages carry the resident `File` (cloned by reference), archive pages
 * carry the chapter graph (plain metadata + the archive `File`).
 */
export interface WireDirectPageFile {
  readonly kind: 'direct';
  readonly resident: File;
}

export interface WireArchivePageFile {
  readonly kind: 'archive';
  readonly name: string;
  readonly type: string;
  readonly lastModified: number;
  readonly chapter: ArchiveChapter;
  readonly entry: ArchiveEntryMeta;
}

export type WirePageFile = WireDirectPageFile | WireArchivePageFile;

export type WireLoadedImage = Omit<LoadedImage, 'file'> & {
  readonly file: WirePageFile;
};

export type WireCaptureState = Omit<DashboardWorkspaceCaptureState, 'images'> & {
  readonly images: WireLoadedImage[];
};

export const toWirePageFile = (file: PageFile): WirePageFile => {
  if (file.kind === 'direct') {
    return { kind: 'direct', resident: file.resident };
  }
  return {
    kind: 'archive',
    name: file.name,
    type: file.type,
    lastModified: file.lastModified,
    chapter: file.chapter,
    entry: file.entry,
  };
};

export const toWireCaptureState = (
  state: DashboardWorkspaceCaptureState,
): WireCaptureState => ({
  ...state,
  images: state.images.map((image) => ({
    ...image,
    file: toWirePageFile(image.file),
  })),
});

export interface WorkspaceSerializeRequest {
  readonly kind: 'serialize';
  readonly id: string;
  readonly state: WireCaptureState;
}

export interface WorkspaceSerializeSuccess {
  readonly kind: 'serialize-success';
  readonly id: string;
  readonly payload: WorkspacePackagePayload;
  readonly autosaveSignature: string;
  readonly historySignature: string;
}

export interface WorkspaceSerializeError {
  readonly kind: 'serialize-error';
  readonly id: string;
  readonly message: string;
}

export type WorkspaceSerializeResponse =
  | WorkspaceSerializeSuccess
  | WorkspaceSerializeError;

/**
 * Narrow transport surface used by the bridge; the real module `Worker`
 * satisfies it structurally, which keeps the injectable test factory free of
 * type assertions.
 */
export interface WorkerTransport {
  postMessage(message: WorkspaceSerializeRequest, transfer?: Transferable[]): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<WorkspaceSerializeResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
}

export type CreateWorkerTransport = () => WorkerTransport | null;

export interface WorkerSerializeResult {
  readonly payload: WorkspacePackagePayload;
  readonly autosaveSignature: string;
  readonly historySignature: string;
}

const SERIALIZE_TIMEOUT_MS = 30_000;
const MAX_WORKER_FAILURES = 2;

const defaultCreateWorkerTransport = (): WorkerTransport | null => {
  if (typeof Worker === 'undefined') return null;
  try {
    return new Worker(new URL('./workspaceSerializerWorker.ts', import.meta.url), {
      type: 'module',
    });
  } catch {
    return null;
  }
};

interface PendingSerializeJob {
  readonly id: string;
  readonly state: DashboardWorkspaceCaptureState;
  readonly resolve: (result: WorkerSerializeResult) => void;
  readonly reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout> | null;
}

const pendingSerializeJobs = new Map<string, PendingSerializeJob>();
let createWorkerTransport: CreateWorkerTransport = defaultCreateWorkerTransport;
let sharedSerializerWorker: WorkerTransport | null = null;
let workerFailureCount = 0;
let workerPermanentlyDegraded = false;
let nextSerializeJobId = 1;

const clearSerializeTimer = (job: PendingSerializeJob): void => {
  if (job.timer !== null) {
    clearTimeout(job.timer);
    job.timer = null;
  }
};

const dropSharedTransport = (): void => {
  const transport = sharedSerializerWorker;
  if (!transport) return;
  sharedSerializerWorker = null;
  transport.terminate();
};

const countWorkerFailure = (): void => {
  workerFailureCount += 1;
  if (workerFailureCount < MAX_WORKER_FAILURES) return;
  workerPermanentlyDegraded = true;
  dropSharedTransport();
};

/**
 * The degraded path is the exact pre-worker sequence, so fallback output is
 * byte-identical to today's main-thread autosave.
 */
const runFallbackSerialization = async (
  state: DashboardWorkspaceCaptureState,
): Promise<WorkerSerializeResult> => ({
  payload: await captureWorkspaceDocument(state),
  autosaveSignature: buildWorkspaceAutosaveSignature(state),
  historySignature: buildWorkspaceHistorySignature(state),
});

const settleJobFromFallback = async (job: PendingSerializeJob): Promise<void> => {
  try {
    job.resolve(await runFallbackSerialization(job.state));
  } catch (error) {
    job.reject(error instanceof Error ? error : new Error(String(error)));
  }
};

const settleAllPendingFromFallback = (): void => {
  for (const job of pendingSerializeJobs.values()) {
    pendingSerializeJobs.delete(job.id);
    clearSerializeTimer(job);
    void settleJobFromFallback(job);
  }
};

const ensureSerializerWorker = (): WorkerTransport | null => {
  if (workerPermanentlyDegraded) return null;
  if (sharedSerializerWorker) return sharedSerializerWorker;
  const transport = createWorkerTransport();
  if (!transport) {
    workerPermanentlyDegraded = true;
    return null;
  }
  transport.onmessage = (event) => handleSerializerMessage(event.data);
  transport.onerror = () => handleSerializerWorkerError(transport);
  sharedSerializerWorker = transport;
  return transport;
};

const handleSerializerMessage = (response: WorkspaceSerializeResponse): void => {
  const job = pendingSerializeJobs.get(response.id);
  if (!job) return;
  pendingSerializeJobs.delete(job.id);
  clearSerializeTimer(job);
  if (response.kind === 'serialize-success') {
    job.resolve({
      payload: response.payload,
      autosaveSignature: response.autosaveSignature,
      historySignature: response.historySignature,
    });
    return;
  }
  void settleJobFromFallback(job);
};

const handleSerializerTimeout = (job: PendingSerializeJob): void => {
  job.timer = null;
  pendingSerializeJobs.delete(job.id);
  dropSharedTransport();
  countWorkerFailure();
  void settleJobFromFallback(job);
};

const handleSerializerSendFailure = (job: PendingSerializeJob): void => {
  pendingSerializeJobs.delete(job.id);
  clearSerializeTimer(job);
  countWorkerFailure();
  void settleJobFromFallback(job);
};

const handleSerializerWorkerError = (transport: WorkerTransport): void => {
  if (sharedSerializerWorker === transport) {
    sharedSerializerWorker = null;
  }
  transport.terminate();
  countWorkerFailure();
  if (workerPermanentlyDegraded) {
    settleAllPendingFromFallback();
    return;
  }
  const rebuilt = ensureSerializerWorker();
  if (!rebuilt) {
    settleAllPendingFromFallback();
    return;
  }
  for (const job of pendingSerializeJobs.values()) {
    postSerializeJob(rebuilt, job);
  }
};

const postSerializeJob = (transport: WorkerTransport, job: PendingSerializeJob): void => {
  clearSerializeTimer(job);
  job.timer = setTimeout(() => handleSerializerTimeout(job), SERIALIZE_TIMEOUT_MS);
  try {
    transport.postMessage({
      kind: 'serialize',
      id: job.id,
      state: toWireCaptureState(job.state),
    });
  } catch {
    handleSerializerSendFailure(job);
  }
};

export const runWorkspaceSerialization = (
  state: DashboardWorkspaceCaptureState,
): Promise<WorkerSerializeResult> => {
  const transport = ensureSerializerWorker();
  if (!transport) {
    return runFallbackSerialization(state);
  }
  return new Promise<WorkerSerializeResult>((resolve, reject) => {
    const job: PendingSerializeJob = {
      id: `workspace-serialize-${nextSerializeJobId}`,
      state,
      resolve,
      reject,
      timer: null,
    };
    nextSerializeJobId += 1;
    pendingSerializeJobs.set(job.id, job);
    postSerializeJob(transport, job);
  });
};

export const setWorkspaceSerializerWorkerFactory = (
  factory: CreateWorkerTransport | null,
): void => {
  createWorkerTransport = factory ?? defaultCreateWorkerTransport;
};

export const resetWorkspaceSerializerForTests = (): void => {
  dropSharedTransport();
  pendingSerializeJobs.clear();
  workerFailureCount = 0;
  workerPermanentlyDegraded = false;
  nextSerializeJobId = 1;
  createWorkerTransport = defaultCreateWorkerTransport;
};
