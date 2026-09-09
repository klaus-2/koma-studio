export interface WorkspaceAutosaveSettings {
  enabled: boolean;
  intervalSeconds: number;
}

export const WORKSPACE_AUTOSAVE_SETTINGS_STORAGE_KEY =
  'koma-workspace-autosave-settings-v1';

export const DEFAULT_WORKSPACE_AUTOSAVE_SETTINGS: WorkspaceAutosaveSettings = {
  enabled: true,
  intervalSeconds: 60,
};

const clampIntervalSeconds = (value: unknown): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_WORKSPACE_AUTOSAVE_SETTINGS.intervalSeconds;
  }

  return Math.min(3600, Math.max(15, Math.round(numeric)));
};

export const sanitizeWorkspaceAutosaveSettings = (
  value: unknown,
): WorkspaceAutosaveSettings => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_WORKSPACE_AUTOSAVE_SETTINGS };
  }

  const payload = value as Partial<WorkspaceAutosaveSettings>;
  return {
    enabled:
      typeof payload.enabled === 'boolean'
        ? payload.enabled
        : DEFAULT_WORKSPACE_AUTOSAVE_SETTINGS.enabled,
    intervalSeconds: clampIntervalSeconds(payload.intervalSeconds),
  };
};

export const loadWorkspaceAutosaveSettings =
  (): WorkspaceAutosaveSettings => {
    if (typeof window === 'undefined') {
      return { ...DEFAULT_WORKSPACE_AUTOSAVE_SETTINGS };
    }

    try {
      const raw = window.localStorage.getItem(
        WORKSPACE_AUTOSAVE_SETTINGS_STORAGE_KEY,
      );
      if (!raw) {
        return { ...DEFAULT_WORKSPACE_AUTOSAVE_SETTINGS };
      }
      return sanitizeWorkspaceAutosaveSettings(JSON.parse(raw));
    } catch {
      return { ...DEFAULT_WORKSPACE_AUTOSAVE_SETTINGS };
    }
  };

export const saveWorkspaceAutosaveSettings = (
  value: WorkspaceAutosaveSettings,
): WorkspaceAutosaveSettings => {
  const sanitized = sanitizeWorkspaceAutosaveSettings(value);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(
      WORKSPACE_AUTOSAVE_SETTINGS_STORAGE_KEY,
      JSON.stringify(sanitized),
    );
    window.dispatchEvent(
      new CustomEvent('koma:workspace-autosave-settings-changed', {
        detail: sanitized,
      }),
    );
  }
  return sanitized;
};
