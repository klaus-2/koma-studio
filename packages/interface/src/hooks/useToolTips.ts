import { useCallback, useEffect, useState } from 'react';
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

export const TOOL_TIPS_DISMISSED_STORAGE_KEY = 'koma-studio.tool-tips.dismissed.v1';

function getDismissedForever(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(TOOL_TIPS_DISMISSED_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? new Set(parsed.filter((id): id is string => typeof id === 'string'))
      : new Set();
  } catch {
    return new Set();
  }
}

function writeDismissedForever(tipId: string, dismissed: boolean): Set<string> {
  const ids = getDismissedForever();
  if (dismissed) ids.add(tipId);
  else ids.delete(tipId);
  try {
    window.localStorage.setItem(TOOL_TIPS_DISMISSED_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    return ids;
  }
  return ids;
}

export function useToolTips() {
  const [settings, setSettings] = useState<ToolTipsSettings>(
    loadToolTipsSettings,
  );
  const [dismissedForever, setDismissedForeverIds] = useState<Set<string>>(
    getDismissedForever,
  );
  // ponytail: render-rule fix — getSeenThisSession() reads sessionStorage, so
  // the function-initializer form runs it once per mount instead of on every
  // render; the Set identity stays stable across renders and dismiss() still
  // mutates it in place without triggering a re-render, as before.
  const [seenSet] = useState<Set<string>>(getSeenThisSession);

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
      if (dismissedForever.has(tipId)) return false;
      return !seenSet.has(tipId);
    },
    [dismissedForever, seenSet, settings.enabled],
  );

  const dismiss = useCallback((tipId: string): void => {
    markSeenThisSession(tipId);
    seenSet.add(tipId);
  }, [seenSet]);

  const isDismissedForever = useCallback(
    (tipId: string): boolean => dismissedForever.has(tipId),
    [dismissedForever],
  );

  const setDismissedForever = useCallback((tipId: string, dismissed: boolean): void => {
    setDismissedForeverIds(writeDismissedForever(tipId, dismissed));
  }, []);

  const setEnabled = useCallback((enabled: boolean): void => {
    setSettings(saveToolTipsSettings({ enabled }));
  }, []);

  return {
    shouldShow,
    dismiss,
    isDismissedForever,
    setDismissedForever,
    enabled: settings.enabled,
    setEnabled,
  };
}
