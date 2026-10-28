import type {
  DesktopDownloadModelPayload,
  DesktopModelManagerEvent,
  ModelDownloadJobSnapshot,
} from "./types.ts";

const readBackendErrorDetail = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { detail?: unknown };
    return typeof payload.detail === "string" ? payload.detail : "";
  } catch {
    return "";
  }
};

const createModelDownloadJob = async (
  backendBaseUrl: string,
  headers: () => Record<string, string>,
  model: DesktopDownloadModelPayload,
  signal: AbortSignal,
): Promise<string> => {
  const response = await fetch(`${backendBaseUrl}/models/downloads`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model_id: model.id,
      source_language:
        typeof model.sourceLanguage === "string" && model.sourceLanguage.trim()
          ? model.sourceLanguage.trim().toLowerCase()
          : null,
      required_disk_bytes: Math.max(0, Math.round(model.requiredDiskBytes)),
      download_url: model.downloadUrl,
      checksum_sha256: model.checksumSHA256,
      expected_download_bytes: Math.max(0, Math.round(model.expectedDownloadBytes || 0)),
    }),
    signal,
  });

  if (!response.ok) {
    const detail = await readBackendErrorDetail(response);
    if (response.status === 404) {
      // Local backend without the job routes: legacy code is running
      // (an orphan process was reused) — the app/backend must be restarted.
      const error = new Error(
        "The local model backend is outdated. Restart the app so it can pick up the new backend.",
      ) as Error & { code?: string };
      error.code = "network";
      throw error;
    }
    throw new Error(
      detail || `Failed to queue the model download (HTTP ${response.status}).`,
    );
  }

  const payload = (await response.json()) as { jobId?: unknown };
  if (typeof payload.jobId !== "string" || !payload.jobId) {
    throw new Error("Mini backend did not return a download job id.");
  }
  return payload.jobId;
};

const fetchModelJobSnapshot = async (
  backendBaseUrl: string,
  jobId: string,
  headers: () => Record<string, string>,
  signal: AbortSignal,
): Promise<ModelDownloadJobSnapshot | null> => {
  let response: Response;
  try {
    response = await fetch(`${backendBaseUrl}/models/downloads/${jobId}`, {
      headers: headers(),
      signal,
    });
  } catch (error) {
    if (signal.aborted) {
      return null;
    }
    // Transient instability: keep polling.
    console.warn(`[models] job poll failed for ${jobId}:`, error);
    return null;
  }
  if (response.status === 404) {
    // Backend restarted and lost the in-memory job. Fail and retry:
    // the new submit will resume from the preserved .part file on disk.
    const error = new Error(
      "Model download job was lost because the local backend restarted.",
    ) as Error & { code?: string };
    error.code = "network";
    throw error;
  }
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as ModelDownloadJobSnapshot;
};

const cancelModelDownloadJob = async (
  backendBaseUrl: string,
  jobId: string,
  headers: () => Record<string, string>,
  signal: AbortSignal,
): Promise<void> => {
  try {
    await fetch(`${backendBaseUrl}/models/downloads/${jobId}/cancel`, {
      method: "POST",
      headers: headers(),
      signal,
    });
  } catch {
    // Best effort: the job will also expire on its own when the network errors.
  }
};

const emitProgressFromJobSnapshot = (
  model: DesktopDownloadModelPayload,
  attempt: number,
  snapshot: ModelDownloadJobSnapshot,
  emit: (event: DesktopModelManagerEvent) => void,
): void => {
  const bytesDownloaded = Math.max(0, Math.round(snapshot.bytesDownloaded || 0));
  // The backend owns the total. When it does not know one yet the value
  // stays null and the UI renders an indeterminate state — substituting the
  // registry's estimate here would show a percentage of a fiction.
  const totalBytes =
    snapshot.totalBytes === null || snapshot.totalBytes === undefined
      ? null
      : Math.max(0, Math.round(snapshot.totalBytes));
  const percent =
    snapshot.percent === null || snapshot.percent === undefined
      ? totalBytes !== null && totalBytes > 0
        ? (bytesDownloaded / totalBytes) * 100
        : null
      : snapshot.percent;

  emit({
    type: "progress",
    modelId: model.id,
    bytesDownloaded,
    totalBytes,
    speedBytesPerSecond: Math.max(0, Math.round(snapshot.speedBytesPerSecond || 0)),
    percent: percent === null ? null : Math.max(0, Math.min(100, percent)),
    attempt,
  });
};

const shouldRetryDownload = (error: Error): boolean => {
  // The new taxonomy takes precedence; string parsing is just a safety net
  // for errors that didn't come from the job.
  const code = (error as Error & { code?: string }).code;
  if (code === "checksum_mismatch" || code === "disk_full" || code === "cancelled") {
    return false;
  }
  if (code === "network" || code === "rate_limited") {
    return true;
  }
  if (code === "unknown") {
    return false;
  }

  const message = error.message.toLowerCase();
  if (message.includes("invalid sha256 checksum")) {
    return false;
  }

  if (message.includes("insufficient disk space")) {
    return false;
  }

  const httpStatusMatch = message.match(/http\s+(\d{3})/i);
  if (httpStatusMatch?.[1]) {
    const status = Number(httpStatusMatch[1]);
    if (Number.isFinite(status) && status >= 400 && status < 500 && status !== 408 && status !== 429) {
      return false;
    }
  }

  return true;
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

interface BackendJobInstallOptions {
  headers: () => Record<string, string>;
  pollIntervalMs: () => number;
  maxConsecutivePollFailures: () => number;
  emit: (event: DesktopModelManagerEvent) => void;
  validateInstalledModel: (model: DesktopDownloadModelPayload) => Promise<void>;
}

const runBackendJobInstall = async (
  backendBaseUrl: string,
  model: DesktopDownloadModelPayload,
  attempt: number,
  signal: AbortSignal,
  options: BackendJobInstallOptions,
): Promise<void> => {
  if (!backendBaseUrl) {
    throw new Error("Mini backend unavailable to install the local model.");
  }

  const jobId = await createModelDownloadJob(backendBaseUrl, options.headers, model, signal);
  let lastEmittedState = "";
  let firstSnapshot = true;
  let consecutivePollFailures = 0;

  while (true) {
    if (signal.aborted) {
      break;
    }

    // Poll immediately, then on a short interval: a transfer that finishes
    // inside one interval must still be observed while it is running.
    if (!firstSnapshot) {
      await sleep(options.pollIntervalMs());
    }
    firstSnapshot = false;

    const snapshot = await fetchModelJobSnapshot(backendBaseUrl, jobId, options.headers, signal);
    if (!snapshot) {
      consecutivePollFailures += 1;
      if (consecutivePollFailures > options.maxConsecutivePollFailures()) {
        const error = new Error(
          "The local backend stopped responding during the model download.",
        ) as Error & { code?: string };
        error.code = "network";
        throw error;
      }
      continue;
    }

    consecutivePollFailures = 0;

    if (snapshot.state !== lastEmittedState) {
      lastEmittedState = snapshot.state;
      if (snapshot.state === "verifying") {
        options.emit({ type: "verifying", modelId: model.id });
      }
      if (snapshot.state === "queued") {
        options.emit({ type: "queued", modelId: model.id });
      }
    }

    if (snapshot.state === "downloading") {
      emitProgressFromJobSnapshot(model, attempt, snapshot, options.emit);
      continue;
    }

    if (snapshot.state === "ready") {
      await options.validateInstalledModel(model);
      return;
    }

    if (snapshot.state === "error") {
      const error = new Error(
        snapshot.errorMessage || `Download failed (${snapshot.errorCode ?? "unknown"}).`,
      );
      (error as Error & { code?: string }).code =
        snapshot.errorCode && snapshot.errorCode !== "cancelled"
          ? snapshot.errorCode
          : "unknown";
      throw error;
    }

    if (snapshot.state === "cancelled") {
      throw new Error("Download cancelled.");
    }
  }

  // Loop exited via abort: request backend cancellation and propagate.
  void cancelModelDownloadJob(backendBaseUrl, jobId, options.headers, signal);
  throw new Error("Download cancelled.");
};

export { runBackendJobInstall, shouldRetryDownload };
