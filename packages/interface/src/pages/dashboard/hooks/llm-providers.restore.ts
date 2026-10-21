import type { DashboardWorkspaceRestoreState } from '../../../workspace/dashboardWorkspace';
import {
  createEmptyCustomLlmDraft,
  type CustomLlmProfile,
  type CustomLlmProfileDraft,
  type CustomLlmStage,
  type LlmProfilesPersistenceMode,
} from '../../../utils/customLlm';

/**
 * LLM profile/draft restore merges. Profiles merge byId with updatedAt-newer-
 * wins (NaN-tolerant) and a fixed pt-BR label order so the resulting capture
 * signature is deterministic; the persistence mode refuses a
 * desktop_secure/desktop_local downgrade; drafts fall back per stage.
 */
export const mergeRestoredCustomLlmProfiles = (
  restored: DashboardWorkspaceRestoreState,
): ((prev: CustomLlmProfile[]) => CustomLlmProfile[]) =>
(prev) => {
  const restoredProfiles =
    (restored.document.llm.customLlmProfiles as CustomLlmProfile[]) ?? [];
  const byId = new Map<string, CustomLlmProfile>();
  for (const profile of [...prev, ...restoredProfiles]) {
    if (!profile?.id) {
      continue;
    }
    const current = byId.get(profile.id);
    if (!current) {
      byId.set(profile.id, profile);
      continue;
    }
    const currentTime = Date.parse(current.updatedAt || current.createdAt || '');
    const nextTime = Date.parse(profile.updatedAt || profile.createdAt || '');
    if (Number.isNaN(currentTime) || (!Number.isNaN(nextTime) && nextTime >= currentTime)) {
      byId.set(profile.id, profile);
    }
  }
  return Array.from(byId.values()).sort((left, right) =>
    left.label.localeCompare(right.label, 'pt-BR'),
  );
};

export const resolveRestoredCustomLlmProfilesMode = (
  restored: DashboardWorkspaceRestoreState,
): ((prev: LlmProfilesPersistenceMode) => LlmProfilesPersistenceMode) =>
(prev) => {
  if (prev === 'desktop_secure' || prev === 'desktop_local') {
    return prev;
  }
  return restored.document.llm.customLlmProfilesMode as LlmProfilesPersistenceMode;
};

export const buildRestoredCustomLlmDrafts = (
  restored: DashboardWorkspaceRestoreState,
): Record<CustomLlmStage, CustomLlmProfileDraft> => {
  const restoredDrafts = restored.document.llm.customLlmDrafts as
    | Record<CustomLlmStage, CustomLlmProfileDraft>
    | undefined;
  return {
    translation: restoredDrafts?.translation ?? createEmptyCustomLlmDraft(),
    ocr: restoredDrafts?.ocr ?? createEmptyCustomLlmDraft(),
    clean: restoredDrafts?.clean ?? createEmptyCustomLlmDraft(),
  };
};
