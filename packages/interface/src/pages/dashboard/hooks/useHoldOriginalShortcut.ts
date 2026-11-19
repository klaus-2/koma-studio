import { useEffect, useRef } from 'react';

import {
  collectShortcutStateFromKeyboardEvent,
  findMatchingShortcutAction,
  isEditableShortcutTarget,
  type ShortcutContext,
} from '../../../shortcuts/keyboardShortcuts';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useUiShellStore } from '../stores/ui-shell-store';

const PEEK_ACTION_ID = 'peekOriginalPage';

const buildPeekContext = (): ShortcutContext => {
  const shell = useUiShellStore.getState();
  const { images, activeId } = useImageCollectionStore.getState();
  const resolved = images.find((img) => img.id === activeId) ?? images[0];
  return {
    mode: shell.mode,
    subMode: shell.subMode,
    translatorWorkspaceMode: null,
    activeId: resolved?.id ?? null,
    activeSelectedRegionId: null,
    aioRenderReady: false,
    processing: shell.processing,
  };
};

export function useHoldOriginalShortcut(): void {
  const heldRef = useRef(false);

  useEffect(() => {
    const release = (): void => {
      if (!heldRef.current) return;
      heldRef.current = false;
      const { setHoldOriginalActive } = useUiShellStore.getState();
      setHoldOriginalActive(false);
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.repeat) return;
      if (isEditableShortcutTarget(event.target)) return;
      const pressed = collectShortcutStateFromKeyboardEvent(event);
      if (pressed.length === 0) return;

      const { keyboardShortcutConfig } = useUiShellStore.getState();
      const matched = findMatchingShortcutAction(
        keyboardShortcutConfig,
        pressed,
        buildPeekContext(),
      );
      if (matched?.id !== PEEK_ACTION_ID) return;

      event.preventDefault();
      heldRef.current = true;
      const { setHoldOriginalActive } = useUiShellStore.getState();
      setHoldOriginalActive(true);
    };

    const onKeyUp = (): void => release();
    const onBlur = (): void => release();
    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'hidden') release();
    };

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      release();
    };
  }, []);
}
