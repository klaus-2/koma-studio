import { useCallback, useEffect, useState } from 'react';
import {
  loadCustomCursorSettings,
  saveCustomCursorSettings,
  type CustomCursorSettings,
} from '@/utils/customCursorSettings';

export function useCustomCursor() {
  const [settings, setSettings] = useState<CustomCursorSettings>(
    loadCustomCursorSettings,
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<CustomCursorSettings>).detail;
      if (detail) setSettings(detail);
    };
    window.addEventListener('koma:custom-cursor-changed', handler);
    return () => window.removeEventListener('koma:custom-cursor-changed', handler);
  }, []);

  const setEnabled = useCallback((enabled: boolean): void => {
    setSettings(saveCustomCursorSettings({ enabled }));
  }, []);

  return { enabled: settings.enabled, setEnabled };
}
