import { modelSupportsLanguage } from "../models/translation-models-registry";
import type { TranslationModel } from "../models/types";

/**
 * UI-side sentinel stored in `aioStageSelection.getTranslations` when the user
 * picks the Auto entry. Deliberately NOT `"auto"`: the sidecar's translation
 * factory resolves a bare `"auto"` model key to its own (cloud) default engine,
 * so this sentinel must be distinguishable from backend semantics and is
 * resolved to a concrete registry id before any request leaves the UI.
 */
export const TRANSLATION_AUTO_MODEL_KEY = "__auto__";

export const isTranslationAutoSelectionKey = (value: string): boolean =>
  value === TRANSLATION_AUTO_MODEL_KEY;

export interface TranslationAutoDeviceInfo {
  readonly has_gpu: boolean;
  readonly vram_gb: number | null;
}

/** Minimal install-entry shape the resolver reads (same check as TranslationModelControl). */
export interface TranslationAutoInstallEntryLike {
  readonly status: string;
}

export interface TranslationAutoResolutionInput {
  readonly registryModels: readonly TranslationModel[];
  readonly installEntries: Readonly<
    Record<string, TranslationAutoInstallEntryLike | undefined>
  >;
  readonly sourceLanguage: string;
  readonly targetLanguage: string;
  readonly deviceInfo: TranslationAutoDeviceInfo | null;
}

export interface TranslationAutoResolutionResult {
  readonly modelKey: string | null;
  readonly resolvedName: string;
  readonly resolvedFrom: "auto";
}

/** Resolved-variant payload the stage control renders as the Auto badge. */
export interface TranslationAutoResolved {
  readonly key: string;
  readonly name: string;
}

/** Free VRAM (GB) from which Auto prefers the CT2 GPU variant (GATE-2, option (a)). */
const GPU_VRAM_FLOOR_GB = 3.5;

const JA_EN_GPU_PREFERENCE: readonly string[] = [
  "sugoi_v4_ja_en_ct2",
  "nllb-200-600m-int8",
  "nllb-200-1.3b-int8-ct2",
];
const JA_EN_CPU_PREFERENCE: readonly string[] = [
  "nllb-200-600m-int8",
  "nllb-200-1.3b-int8-ct2",
];
const OTHER_PAIRS_PREFERENCE: readonly string[] = [
  "nllb-200-600m-int8",
  "nllb-200-1.3b-int8-ct2",
  "m2m100_1_2b_ct2",
];

const normalizeLanguageKey = (value: string): string =>
  value.trim().toLowerCase();

const isInstalledEntry = (
  entry: TranslationAutoInstallEntryLike | undefined,
): boolean => entry?.status === "installed" || entry?.status === "update_available";

const preferenceTableFor = (
  sourceLanguage: string,
  targetLanguage: string,
  deviceInfo: TranslationAutoDeviceInfo | null,
): readonly string[] => {
  const isJaToEn =
    normalizeLanguageKey(sourceLanguage) === "ja" &&
    normalizeLanguageKey(targetLanguage) === "en";
  if (!isJaToEn) {
    return OTHER_PAIRS_PREFERENCE;
  }
  const gpuBranch =
    deviceInfo !== null &&
    deviceInfo.has_gpu &&
    (deviceInfo.vram_gb ?? 0) >= GPU_VRAM_FLOOR_GB;
  return gpuBranch ? JA_EN_GPU_PREFERENCE : JA_EN_CPU_PREFERENCE;
};

/**
 * Picks the FIRST INSTALLED registry variant of the GATE-2 hardware-conditioned
 * preference table. Installed-only (status "installed" | "update_available"):
 * Auto never triggers a download, and only local registry ids are candidates —
 * cloud/legacy options are never returned.
 */
export function resolveTranslationAutoModel(
  input: TranslationAutoResolutionInput,
): TranslationAutoResolutionResult {
  const preference = preferenceTableFor(
    input.sourceLanguage,
    input.targetLanguage,
    input.deviceInfo,
  );
  const byId = new Map(
    input.registryModels.map((model) => [model.id, model] as const),
  );
  for (const modelId of preference) {
    const model = byId.get(modelId);
    if (model === undefined) {
      continue;
    }
    if (
      !modelSupportsLanguage(model, input.sourceLanguage, input.targetLanguage)
    ) {
      continue;
    }
    if (!isInstalledEntry(input.installEntries[modelId])) {
      continue;
    }
    return { modelKey: model.id, resolvedName: model.name, resolvedFrom: "auto" };
  }
  return { modelKey: null, resolvedName: "", resolvedFrom: "auto" };
}

export const toAutoResolvedBadge = (
  result: TranslationAutoResolutionResult,
): TranslationAutoResolved | null =>
  result.modelKey === null
    ? null
    : { key: result.modelKey, name: result.resolvedName };

/**
 * Execution-side resolution: the sentinel becomes the resolved registry id so
 * the running config never carries it (the sidecar refuses the sentinel, and a
 * bare `"auto"` would select the sidecar's cloud default). Unresolvable Auto
 * keeps the sentinel so the readiness gate refuses with the install flow
 * instead of silently swapping engines.
 */
export function resolveTranslationStageExecutionKey(
  selectionKey: string,
  input: TranslationAutoResolutionInput,
): string {
  if (!isTranslationAutoSelectionKey(selectionKey)) {
    return selectionKey;
  }
  return resolveTranslationAutoModel(input).modelKey ?? selectionKey;
}
