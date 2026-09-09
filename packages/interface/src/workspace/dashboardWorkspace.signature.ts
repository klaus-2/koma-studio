import type { DashboardWorkspaceCaptureState } from "./dashboardWorkspace";

const signatureReplacer = (_key: string, value: unknown): unknown => {
  if (typeof value === "string" && value.startsWith("data:")) {
    return {
      __type: "DataUrl",
      length: value.length,
      head: value.slice(0, 48),
      tail: value.slice(-48),
    };
  }
  if (typeof value === "function") {
    return undefined;
  }
  if (typeof window !== "undefined" && value === window) {
    return undefined;
  }
  if (value instanceof File) {
    return {
      __type: "File",
      name: value.name,
      size: value.size,
      type: value.type,
      lastModified: value.lastModified,
    };
  }
  if (value instanceof Blob) {
    return {
      __type: "Blob",
      size: value.size,
      type: value.type,
    };
  }
  return value;
};

const normalizeSignatureValue = (
  value: unknown,
  seen: WeakSet<object>,
  depth = 0,
): unknown => {
  const replaced = signatureReplacer("", value);
  if (
    replaced == null ||
    typeof replaced === "string" ||
    typeof replaced === "number" ||
    typeof replaced === "boolean"
  ) {
    return replaced;
  }
  if (typeof replaced === "bigint") {
    return replaced.toString();
  }
  if (depth >= 12) {
    return { __type: "MaxDepth" };
  }
  if (replaced instanceof Date) {
    return {
      __type: "Date",
      value: replaced.toISOString(),
    };
  }
  if (replaced instanceof Map) {
    return {
      __type: "Map",
      entries: Array.from(replaced.entries()).map(([key, entry]) => ([
        normalizeSignatureValue(key, seen, depth + 1),
        normalizeSignatureValue(entry, seen, depth + 1),
      ])),
    };
  }
  if (replaced instanceof Set) {
    return {
      __type: "Set",
      values: Array.from(replaced.values()).map((entry) =>
        normalizeSignatureValue(entry, seen, depth + 1),
      ),
    };
  }
  if (typeof replaced !== "object") {
    return replaced;
  }
  if (seen.has(replaced)) {
    return { __type: "Circular" };
  }

  seen.add(replaced);

  if (Array.isArray(replaced)) {
    return replaced.map((entry) =>
      normalizeSignatureValue(entry, seen, depth + 1),
    );
  }

  return Object.fromEntries(
    Object.entries(replaced).flatMap(([key, entry]) => {
      const normalized = normalizeSignatureValue(entry, seen, depth + 1);
      return normalized === undefined ? [] : [[key, normalized] as const];
    }),
  );
};

const buildSignatureString = (value: unknown): string =>
  JSON.stringify(normalizeSignatureValue(value, new WeakSet<object>()));

const buildTypesetterSignatureSummary = (
  value: DashboardWorkspaceCaptureState["typesetter"],
) => ({
  selectionTool: value.selectionTool,
  queueSelectedId: value.queueSelectedId,
  snapshotName: value.snapshotName,
  selectedSnapshotId: value.selectedSnapshotId,
  sessionsByImage: Object.fromEntries(
    Object.entries(value.sessionsByImage).map(([imageId, session]) => [
      imageId,
      {
        imageFingerprint: session.imageFingerprint,
        sourceType: session.sourceType,
        activePresetId: session.activePresetId,
        selectedRegionId: session.selectedRegionId,
        updatedAt: session.updatedAt,
      },
    ]),
  ),
});

const buildWorkspaceSignatureBase = (
  state: DashboardWorkspaceCaptureState,
) => ({
  images: state.images.map((item) => ({
    id: item.id,
    file: item.file,
    width: item.width,
    height: item.height,
    rotation: item.rotation,
    filters: item.filters,
  })),
  downloadItems: state.downloadItems.map((item) => ({
    name: item.name,
    blob: item.blob,
    scope: item.scope,
    sourceImageId: item.sourceImageId,
  })),
  aio: state.aio,
  cleaner: state.cleaner,
  translator: state.translator,
  typesetter: buildTypesetterSignatureSummary(state.typesetter),
  enhance: state.enhance,
  utility: {
    ...state.utility,
    watermark: {
      ...state.utility.watermark,
      results: state.utility.watermark.results.map((item) => ({
        sourceImageId: item.sourceImageId,
        name: item.name,
        blob: item.blob,
        resolvedAnchor: item.resolvedAnchor,
      })),
    },
  },
  llm: state.llm,
});

export const buildWorkspaceHistorySignature = (
  state: DashboardWorkspaceCaptureState,
): string =>
  buildSignatureString(buildWorkspaceSignatureBase(state));

export const buildWorkspaceAutosaveSignature = (
  state: DashboardWorkspaceCaptureState,
): string =>
  buildSignatureString({
    autosaveScope: state.autosaveScope,
    autosaveUserId: state.autosaveUserId,
    mode: state.mode,
    subMode: state.subMode,
    activeImageId: state.activeImageId,
    viewMode: state.viewMode,
    translatorWorkspaceMode: state.translatorWorkspaceMode,
    batchThreadsEnabled: state.batchThreadsEnabled,
    batchThreads: state.batchThreads,
    ...buildWorkspaceSignatureBase(state),
  });
