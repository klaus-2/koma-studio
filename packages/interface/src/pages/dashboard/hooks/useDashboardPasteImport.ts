import { useEffect } from 'react';

import { DASHBOARD_UPLOAD_ACCEPT } from '../../../constants/dashboard.constants';
import { isEditableShortcutTarget } from '../../../shortcuts/keyboardShortcutUtils';
import type {
  ToolMode,
  TranslatorWorkspaceMode,
} from '../../../types/dashboard.types';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useTranslatorStore } from '../stores/translator-store';
import { useUiShellStore } from '../stores/ui-shell-store';
import { buildUploadAcceptMatcher, fileAccepts } from './useUploadDropzone';

interface StageModeState {
  mode: ToolMode;
  translatorWorkspaceMode: TranslatorWorkspaceMode;
  imageCount: number;
}

/**
 * True when the center stage is a workspace instead of the page grid — the
 * exact decision the stage itself makes (StageGrid.tsx:603-633): the info and
 * integration modes, the special workspaces, and the translator variants that
 * do not render pages (text workspace, or visual workspace with an empty
 * library). Paste import stays inert there so those surfaces keep their own
 * paste semantics (Blogger editor, Imgur queue, translator text import, ...).
 */
export const isWorkspaceStageMode = ({
  mode,
  translatorWorkspaceMode,
  imageCount,
}: StageModeState): boolean => {
  if (
    mode === 'guides' ||
    mode === 'resources' ||
    mode === 'blogger' ||
    mode === 'imgur'
  ) {
    return true;
  }
  if (
    mode === 'stitch' ||
    mode === 'split' ||
    mode === 'watermark' ||
    mode === 'optimizer'
  ) {
    return true;
  }
  if (mode === 'translator') {
    return translatorWorkspaceMode === 'text' || imageCount === 0;
  }
  return false;
};

interface UseDashboardPasteImportArgs {
  /**
   * The dashboard's drop-import callback. Paste hands over the accepted
   * clipboard files through it, so the two-phase duplicate review and the
   * library insertion are inherited verbatim — never duplicated here.
   */
  onDrop: (files: File[]) => void | Promise<void>;
}

/**
 * Window-level Ctrl+V import: pasted image files flow through the exact drop
 * pipeline. Store state is read at event time via `getState()` so the listener
 * stays registered across mode/processing churn and never sees a stale
 * closure. Guards, in order: busy extraction (silent, identical to a disabled
 * drop) → editable target (native paste wins) → workspace stage (inert) →
 * accepted image files (import + preventDefault) → otherwise surface the same
 * "No compatible file was found." warning an empty drop produces.
 */
export function useDashboardPasteImport({
  onDrop,
}: UseDashboardPasteImportArgs): void {
  useEffect(() => {
    const matcher = buildUploadAcceptMatcher(DASHBOARD_UPLOAD_ACCEPT);
    const handlePaste = (event: ClipboardEvent): void => {
      // While composite files are being extracted the dropzone is disabled
      // and drops are ignored; the paste is ignored the same way.
      if (useImageCollectionStore.getState().isExtractingUploads) {
        return;
      }
      const clipboardFiles = event.clipboardData?.files;
      const acceptedImages = clipboardFiles
        ? Array.from(clipboardFiles).filter((file) =>
            fileAccepts(file, matcher),
          )
        : [];
      // Editable targets (inline text editors, inputs) keep native paste:
      // the listener never intercepts and never calls preventDefault here.
      if (isEditableShortcutTarget(event.target)) {
        return;
      }
      const shellState = useUiShellStore.getState();
      if (
        isWorkspaceStageMode({
          mode: shellState.mode,
          translatorWorkspaceMode:
            useTranslatorStore.getState().translatorWorkspaceMode,
          imageCount: useImageCollectionStore.getState().images.length,
        })
      ) {
        return;
      }
      if (acceptedImages.length > 0) {
        // Paste acts exactly like a drop of the accepted files.
        event.preventDefault();
        void onDrop(acceptedImages);
        return;
      }
      // No compatible image on the clipboard: an empty drop surfaces the
      // shared 'No compatible file was found.' status — same code path.
      void onDrop([]);
    };
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [onDrop]);
}
