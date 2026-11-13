import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';

import { useI18n } from '../i18n';
import {
  getPaletteActions,
  getRecentPaletteActionIds,
  matchPaletteActions,
  orderPaletteActionsByRecency,
  PALETTE_CATEGORY_LABEL_KEYS,
  recordPaletteActionRun,
  type PaletteActionView,
} from './paletteActions';

export interface CommandPaletteModelProps {
  onClose: () => void;
}

export interface CommandPaletteModel {
  query: string;
  setQuery: (query: string) => void;
  selectedIdx: number;
  setSelectedIdx: (idx: number) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  results: PaletteActionView[];
  hasRecents: boolean;
  runAction: (view: PaletteActionView) => void;
  handleInputKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
}

/** Shared by every Command Palette shell (classic, noir); the shells own the markup. */
export function useCommandPaletteModel({
  onClose,
}: CommandPaletteModelProps): CommandPaletteModel {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const views = useMemo<PaletteActionView[]>(
    () =>
      getPaletteActions().map((action) => ({
        action,
        title: t(action.titleKey),
        detail: t(PALETTE_CATEGORY_LABEL_KEYS[action.category]),
      })),
    [t],
  );

  const trimmedQuery = query.trim();
  const results = useMemo(() => {
    const matched = matchPaletteActions(views, query);
    return trimmedQuery ? matched : orderPaletteActionsByRecency(matched);
  }, [query, trimmedQuery, views]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  const hasRecents = trimmedQuery.length === 0 && getRecentPaletteActionIds().length > 0;

  const runAction = useCallback(
    (view: PaletteActionView) => {
      recordPaletteActionRun(view.action.id);
      view.action.run();
      onClose();
    },
    [onClose],
  );

  const handleInputKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      event.stopPropagation();
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIdx((prev) => Math.min(prev + 1, Math.max(results.length - 1, 0)));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIdx((prev) => Math.max(prev - 1, 0));
      } else if (event.key === 'Enter' && results[selectedIdx]) {
        event.preventDefault();
        runAction(results[selectedIdx]);
      }
    },
    [results, runAction, selectedIdx],
  );

  return {
    query,
    setQuery,
    selectedIdx,
    setSelectedIdx,
    inputRef,
    results,
    hasRecents,
    runAction,
    handleInputKeyDown,
  };
}
