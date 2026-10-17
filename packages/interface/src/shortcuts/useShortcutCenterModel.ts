import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import {
  clearShortcutActionCombo,
  collectShortcutStateFromKeyboardEvent,
  FIXED_CONTEXT_SHORTCUTS,
  getShortcutConflict,
  getShortcutDisplayLabel,
  isCompleteShortcutCombo,
  resetKeyboardShortcutConfig,
  restoreShortcutActionCombo,
  saveKeyboardShortcutConfig,
  setShortcutActionCombo,
  SHORTCUT_ACTIONS,
  SHORTCUT_CATEGORY_LABELS,
  type KeyboardShortcutConfigV2,
  type ShortcutActionDefinition,
  type ShortcutActionId,
} from './keyboardShortcuts';

export interface ShortcutCenterModalProps {
  open: boolean;
  config: KeyboardShortcutConfigV2;
  onConfigChange: (next: KeyboardShortcutConfigV2) => void;
  onClose: () => void;
}

export const CATEGORY_ORDER = ['global', 'modes', 'typesetter', 'palette'] as const;

/** Shared by every Shortcut Center shell (classic, noir); the shells own the markup. */
export function useShortcutCenterModel({
  open,
  config,
  onConfigChange,
  onClose,
}: ShortcutCenterModalProps) {
  const { t } = useI18n();
  const [recordingId, setRecordingId] = useState<ShortcutActionId | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<{
    id: ShortcutActionId | null;
    msg: string | null;
  }>({ id: null, msg: null });

  const [rowsVisible, setRowsVisible] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => setRowsVisible(true), 0);
    return () => window.clearTimeout(handle);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (recordingId) {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'Escape') {
          setRecordingId(null);
          setError({ id: null, msg: null });
          return;
        }
        const combo = collectShortcutStateFromKeyboardEvent(e);
        if (!isCompleteShortcutCombo(combo)) return;
        const conflict = getShortcutConflict(config, recordingId, combo);
        if (conflict) {
          setError({
            id: recordingId,
            msg: t('shortcutModal.conflict', { label: t(conflict.label as any), combo: getShortcutDisplayLabel(config.shortcuts[conflict.id] ?? [], t('shortcuts.noShortcut')) }),
          });
          return;
        }
        onConfigChange(
          saveKeyboardShortcutConfig(
            setShortcutActionCombo(config, recordingId, combo),
          ),
        );
        setRecordingId(null);
        setError({ id: null, msg: null });
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [config, onClose, onConfigChange, open, recordingId, t]);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const grouped = useMemo(() => {
    const m = new Map<string, ShortcutActionDefinition[]>();
    CATEGORY_ORDER.forEach((c) =>
      m.set(
        c,
        SHORTCUT_ACTIONS.filter((a) => {
          if (a.category !== c) return false;
          if (!normalizedSearchQuery) return true;
          const haystack = [
            t(a.label as any),
            t(a.description as any),
            t(SHORTCUT_CATEGORY_LABELS[a.category] as any),
            getShortcutDisplayLabel(config.shortcuts[a.id] ?? [], t('shortcuts.noShortcut')),
          ]
            .join(' ')
            .toLowerCase();
          return haystack.includes(normalizedSearchQuery);
        }),
      ),
    );
    return m;
  }, [config.shortcuts, normalizedSearchQuery, t]);

  const filteredFixedShortcuts = useMemo(
    () =>
      FIXED_CONTEXT_SHORTCUTS.filter((shortcut) => {
        if (!normalizedSearchQuery) return true;
        return [
          t(shortcut.label as any),
          t(shortcut.description as any),
          getShortcutDisplayLabel(shortcut.combo, t('shortcuts.noShortcut')),
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearchQuery);
      }),
    [normalizedSearchQuery, t],
  );

  const visibleShortcutCount = useMemo(() => {
    const groupedCount = CATEGORY_ORDER.reduce(
      (total, category) => total + (grouped.get(category)?.length ?? 0),
      0,
    );
    return groupedCount + filteredFixedShortcuts.length;
  }, [filteredFixedShortcuts.length, grouped]);

  const startRecord = (id: ShortcutActionId) => {
    setRecordingId(id);
    setError({ id: null, msg: null });
  };
  const clearCombo = (id: ShortcutActionId) => {
    onConfigChange(
      saveKeyboardShortcutConfig(clearShortcutActionCombo(config, id)),
    );
    if (recordingId === id) setRecordingId(null);
    setError({ id: null, msg: null });
  };
  const restoreCombo = (id: ShortcutActionId) => {
    onConfigChange(
      saveKeyboardShortcutConfig(restoreShortcutActionCombo(config, id)),
    );
    if (recordingId === id) setRecordingId(null);
    setError({ id: null, msg: null });
  };
  const restoreAll = () => {
    onConfigChange(resetKeyboardShortcutConfig());
    setRecordingId(null);
    setError({ id: null, msg: null });
  };

  return {
    recordingId,
    searchQuery,
    setSearchQuery,
    error,
    rowsVisible,
    grouped,
    filteredFixedShortcuts,
    visibleShortcutCount,
    startRecord,
    clearCombo,
    restoreCombo,
    restoreAll,
  };
}
