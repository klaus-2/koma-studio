import { useCallback } from 'react';

import { useI18n } from '../../../i18n';
import {
  useFocusModeStore,
  type KomaDisplayMode,
} from '../stores/focus-mode-store';
import { useStatusStore } from '../stores/status-store';
import { useUiShellStore } from '../stores/ui-shell-store';

/**
 * Focus Mode session control: enter / exit / toggle.
 *
 * This hook only flips the persisted display mode (plus the Studio shell
 * stash and user feedback). The dashboard page owns the transition
 * *effects* — forcing the AIO/manual shell on entry and restoring the
 * stash on exit — because those go through page callbacks
 * (`handleModeChange`, `handleAioSubModeChange`) whose snapshot
 * normalisation must not be bypassed.
 *
 * Safe to instantiate from any dashboard-adjacent component (topbars,
 * keyboard dispatch): all state moves through the stores imperatively,
 * so concurrent instances cannot diverge.
 */
export function useFocusMode() {
  const { t } = useI18n();
  const displayMode = useFocusModeStore((s) => s.displayMode);

  const enterFocusMode = useCallback((): boolean => {
    const focus = useFocusModeStore.getState();
    if (focus.displayMode === 'focus') return true;

    const shell = useUiShellStore.getState();
    // A non-AIO tool mid-run owns the processing flag; forcing the AIO
    // shell underneath it would strand its stage. An AIO run, on the
    // other hand, is exactly what Focus displays — let the user in.
    if (shell.processing && shell.mode !== 'aio') {
      useStatusStore
        .getState()
        .setTonedStatus(t('focus.enterBlockedProcessing'), 'warning');
      return false;
    }

    focus.setShellStash({
      mode: shell.mode,
      subMode: shell.subMode,
      viewMode: shell.viewMode,
    });
    // The "entered/exited" status messages are written by the dashboard
    // transition effect, after the shell enforcement/restore writes its
    // own mode-change status — last write wins, so the Focus message
    // must be the last one.
    focus.setDisplayMode('focus');
    return true;
  }, [t]);

  const exitFocusMode = useCallback((): void => {
    const focus = useFocusModeStore.getState();
    if (focus.displayMode !== 'focus') return;
    // Exit is always allowed, including mid-run: the pipeline keeps
    // running in the page hooks regardless of which layout is shown.
    focus.setDisplayMode('studio');
  }, []);

  const toggleFocusMode = useCallback((): boolean => {
    if (useFocusModeStore.getState().displayMode === 'focus') {
      exitFocusMode();
      return true;
    }
    return enterFocusMode();
  }, [enterFocusMode, exitFocusMode]);

  return {
    displayMode: displayMode as KomaDisplayMode,
    isFocusMode: displayMode === 'focus',
    enterFocusMode,
    exitFocusMode,
    toggleFocusMode,
  };
}
