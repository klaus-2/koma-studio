export interface WorkspacePreloadSettings {
  archivePreloadPages: number;
}

export const WORKSPACE_PRELOAD_SETTINGS_STORAGE_KEY =
  'koma-workspace-preload-settings-v1';

export const DEFAULT_WORKSPACE_PRELOAD_SETTINGS: WorkspacePreloadSettings = {
  archivePreloadPages: 2,
};

const clampArchivePreloadPages = (value: unknown): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_WORKSPACE_PRELOAD_SETTINGS.archivePreloadPages;
  }

  return Math.min(8, Math.max(0, Math.round(numeric)));
};

export const sanitizeWorkspacePreloadSettings = (
  value: unknown,
): WorkspacePreloadSettings => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_WORKSPACE_PRELOAD_SETTINGS };
  }

  const payload = value as Partial<WorkspacePreloadSettings>;
  return {
    archivePreloadPages: clampArchivePreloadPages(payload.archivePreloadPages),
  };
};

export const loadWorkspacePreloadSettings =
  (): WorkspacePreloadSettings => {
    if (typeof window === 'undefined') {
      return { ...DEFAULT_WORKSPACE_PRELOAD_SETTINGS };
    }

    try {
      const raw = window.localStorage.getItem(
        WORKSPACE_PRELOAD_SETTINGS_STORAGE_KEY,
      );
      if (!raw) {
        return { ...DEFAULT_WORKSPACE_PRELOAD_SETTINGS };
      }
      return sanitizeWorkspacePreloadSettings(JSON.parse(raw));
    } catch {
      return { ...DEFAULT_WORKSPACE_PRELOAD_SETTINGS };
    }
  };

export const saveWorkspacePreloadSettings = (
  value: WorkspacePreloadSettings,
): WorkspacePreloadSettings => {
  const sanitized = sanitizeWorkspacePreloadSettings(value);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(
      WORKSPACE_PRELOAD_SETTINGS_STORAGE_KEY,
      JSON.stringify(sanitized),
    );
    window.dispatchEvent(
      new CustomEvent('koma:workspace-preload-settings-changed', {
        detail: sanitized,
      }),
    );
  }
  return sanitized;
};
