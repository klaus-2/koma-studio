export interface ToolTipsSettings {
  enabled: boolean;
}

export const TOOL_TIPS_SETTINGS_STORAGE_KEY =
  'koma-studio.tool-tips.v1';

export const DEFAULT_TOOL_TIPS_SETTINGS: ToolTipsSettings = {
  enabled: true,
};

export const sanitizeToolTipsSettings = (
  value: unknown,
): ToolTipsSettings => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_TOOL_TIPS_SETTINGS };
  }

  const payload = value as Partial<ToolTipsSettings>;
  return {
    enabled:
      typeof payload.enabled === 'boolean'
        ? payload.enabled
        : DEFAULT_TOOL_TIPS_SETTINGS.enabled,
  };
};

export const loadToolTipsSettings = (): ToolTipsSettings => {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_TOOL_TIPS_SETTINGS };
  }

  try {
    const raw = window.localStorage.getItem(TOOL_TIPS_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_TOOL_TIPS_SETTINGS };
    }
    return sanitizeToolTipsSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_TOOL_TIPS_SETTINGS };
  }
};

export const saveToolTipsSettings = (
  value: ToolTipsSettings,
): ToolTipsSettings => {
  const sanitized = sanitizeToolTipsSettings(value);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(
      TOOL_TIPS_SETTINGS_STORAGE_KEY,
      JSON.stringify(sanitized),
    );
    window.dispatchEvent(
      new CustomEvent('koma:tool-tips-changed', {
        detail: sanitized,
      }),
    );
  }
  return sanitized;
};
