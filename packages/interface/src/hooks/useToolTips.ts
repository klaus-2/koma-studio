import { useCallback, useEffect, useRef, useState } from 'react';
import {
  loadToolTipsSettings,
  saveToolTipsSettings,
  type ToolTipsSettings,
} from '@/utils/toolTipsSettings';

const SESSION_KEY = 'koma-studio.tool-tips.session.v1';

function getSeenThisSession(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function markSeenThisSession(tipId: string): void {
  if (typeof window === 'undefined') return;
  const seen = getSeenThisSession();
  seen.add(tipId);
  sessionStorage.setItem(SESSION_KEY, JSON.stringify([...seen]));
}

export function useToolTips() {
  const [settings, setSettings] = useState<ToolTipsSettings>(
    loadToolTipsSettings,
  );
  const seenRef = useRef<Set<string>>(getSeenThisSession());

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ToolTipsSettings>).detail;
      if (detail) setSettings(detail);
    };
    window.addEventListener('koma:tool-tips-changed', handler);
    return () => window.removeEventListener('koma:tool-tips-changed', handler);
  }, []);

  const shouldShow = useCallback(
    (tipId: string): boolean => {
      if (!settings.enabled) return false;
      return !seenRef.current.has(tipId);
    },
    [settings.enabled],
  );

  const dismiss = useCallback((tipId: string): void => {
    markSeenThisSession(tipId);
    seenRef.current.add(tipId);
  }, []);

  const setEnabled = useCallback((enabled: boolean): void => {
    setSettings(saveToolTipsSettings({ enabled }));
  }, []);

  return { shouldShow, dismiss, enabled: settings.enabled, setEnabled };
}
