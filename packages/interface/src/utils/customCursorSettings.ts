export interface CustomCursorSettings {
  enabled: boolean;
}

export const CUSTOM_CURSOR_SETTINGS_STORAGE_KEY =
  'koma-studio.custom-cursor.v1';

export const DEFAULT_CUSTOM_CURSOR_SETTINGS: CustomCursorSettings = {
  enabled: true,
};

export const sanitizeCustomCursorSettings = (
  value: unknown,
): CustomCursorSettings => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_CUSTOM_CURSOR_SETTINGS };
  }

  const payload = value as Partial<CustomCursorSettings>;
  return {
    enabled:
      typeof payload.enabled === 'boolean'
        ? payload.enabled
        : DEFAULT_CUSTOM_CURSOR_SETTINGS.enabled,
  };
};

export const loadCustomCursorSettings = (): CustomCursorSettings => {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_CUSTOM_CURSOR_SETTINGS };
  }

  try {
    const raw = window.localStorage.getItem(CUSTOM_CURSOR_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_CUSTOM_CURSOR_SETTINGS };
    }
    return sanitizeCustomCursorSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_CUSTOM_CURSOR_SETTINGS };
  }
};

export const saveCustomCursorSettings = (
  value: CustomCursorSettings,
): CustomCursorSettings => {
  const sanitized = sanitizeCustomCursorSettings(value);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(
      CUSTOM_CURSOR_SETTINGS_STORAGE_KEY,
      JSON.stringify(sanitized),
    );
    window.dispatchEvent(
      new CustomEvent('koma:custom-cursor-changed', {
        detail: sanitized,
      }),
    );
  }
  return sanitized;
};
