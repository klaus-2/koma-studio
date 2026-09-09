import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { AioTextRegion, EditableRegionTextTarget } from '../../../types/dashboard.types';
import type { RenderTextStyle } from '../../../utils/renderText';
import { clamp, getRegionTranslationNotesForDisplay } from '../../../utils/dashboard.utils';
import { useI18n } from '../../../i18n';

export interface TextDetectionPreviewTooltip {
  recognized: string;
  translated: string;
  notes: string;
}

export interface TextDetectionPreviewContextMenu {
  regionId: string;
  x: number;
  y: number;
}

export interface TextDetectionPreviewTextEditor {
  regionId: string;
  x: number;
  y: number;
  value: string;
  target: EditableRegionTextTarget;
}

interface TextDetectionPreviewTextStateDeps {
  regions: AioTextRegion[];
  selectedRegionId: string | null;
  editable: boolean;
  selectionEnabled: boolean;
  onCardSelect: () => void;
  onSelectRegion: (regionId: string | null) => void;
  onRegionsChange: (
    next: AioTextRegion[],
    selectedRegionIdOverride?: string | null,
  ) => void;
  translationNotesEnabled: boolean;
  overlayRef: React.RefObject<HTMLDivElement | null>;
  fallbackStyle: RenderTextStyle;
}

export interface TextDetectionPreviewTextState {
  hoveredRegionId: string | null;
  setHoveredRegionId: React.Dispatch<React.SetStateAction<string | null>>;
  contextMenu: TextDetectionPreviewContextMenu | null;
  setContextMenu: React.Dispatch<
    React.SetStateAction<TextDetectionPreviewContextMenu | null>
  >;
  textEditor: TextDetectionPreviewTextEditor | null;
  setTextEditor: React.Dispatch<
    React.SetStateAction<TextDetectionPreviewTextEditor | null>
  >;
  hoveredRegionTooltip: TextDetectionPreviewTooltip | null;
  contextMenuTargetRegion: AioTextRegion | null;
  handleTextEditorChange: (nextValue: string) => void;
  handleRegionContextMenu: (
    event: React.MouseEvent<HTMLDivElement>,
    region: AioTextRegion,
  ) => void;
  handleRegionDoubleClick: (
    event: React.MouseEvent<HTMLDivElement>,
    region: AioTextRegion,
  ) => void;
  handleContextCopyRecognized: () => void;
  handleContextCopyTranslated: () => void;
  handleContextEditRecognized: () => void;
  handleContextEditTranslated: () => void;
  handleContextRemoveRegion: () => void;
  handleEditorSave: () => void;
  handleEditorCancel: () => void;
}

export const useTextDetectionPreviewTextState = ({
  regions,
  selectedRegionId,
  editable,
  selectionEnabled,
  onCardSelect,
  onSelectRegion,
  onRegionsChange,
  translationNotesEnabled,
  overlayRef,
}: TextDetectionPreviewTextStateDeps): TextDetectionPreviewTextState => {
  const { t } = useI18n();
  const regionsRef = useRef(regions);
  regionsRef.current = regions;
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<TextDetectionPreviewContextMenu | null>(null);
  const [textEditor, setTextEditor] = useState<TextDetectionPreviewTextEditor | null>(null);

  const copyTextToClipboard = useCallback(async (text: string) => {
    const normalized = text.trim();
    if (!normalized) return;
    try {
      await navigator.clipboard.writeText(normalized);
      return;
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = normalized;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      textArea.style.pointerEvents = 'none';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  }, []);

  const getTooltipContent = useCallback(
    (region: AioTextRegion): TextDetectionPreviewTooltip => {
      const recognized = (region.recognizedText ?? '').trim();
      const translated = (region.translatedText ?? '').trim();
      const notes = getRegionTranslationNotesForDisplay(
        region,
        translationNotesEnabled,
      );
      return {
        recognized:
          recognized.length > 0
            ? recognized
            : t('detectionPreview.noTextRecognized'),
        translated:
          translated.length > 0
            ? translated
            : t('detectionPreview.noTranslation'),
        notes: notes.length > 0 ? notes.join(' | ') : t('detectionPreview.noNt'),
      };
    },
    [t, translationNotesEnabled],
  );

  const applyEditedRegionTranslation = useCallback(
    (regionId: string, nextText: string) => {
      const normalizedText = nextText.trim();
      onRegionsChange(
        regionsRef.current.map((item) => {
          if (item.id !== regionId) return item;
          return {
            ...item,
            translatedText: normalizedText,
            translationNotes: undefined,
            translationNoteOverlay: undefined,
            translatorModelKey: item.translatorModelKey ?? 'manual_edit',
          };
        }),
      );
    },
    [onRegionsChange],
  );

  const applyEditedRegionRecognizedText = useCallback(
    (regionId: string, nextText: string) => {
      const normalizedText = nextText.trim();
      onRegionsChange(
        regionsRef.current.map((item) => {
          if (item.id !== regionId) return item;
          return {
            ...item,
            recognizedText: normalizedText,
            ocrModelKey: item.ocrModelKey ?? 'manual_edit',
          };
        }),
      );
    },
    [onRegionsChange],
  );

  const removeRegionById = useCallback(
    (regionId: string) => {
      const nextRegions = regionsRef.current.filter((region) => region.id !== regionId);
      onRegionsChange(
        nextRegions,
        selectedRegionId === regionId
          ? (nextRegions[0]?.id ?? null)
          : selectedRegionId,
      );
      setContextMenu(null);
      setTextEditor((prev) => (prev?.regionId === regionId ? null : prev));
    },
    [onRegionsChange, selectedRegionId],
  );

  const openEditorForTarget = useCallback(
    (target: EditableRegionTextTarget) => {
      if (!editable) {
        setContextMenu(null);
        setTextEditor(null);
        return;
      }
      if (!contextMenu) {
        setTextEditor(null);
        return;
      }
      const region = regionsRef.current.find((item) => item.id === contextMenu.regionId);
      if (!region) {
        setContextMenu(null);
        setTextEditor(null);
        return;
      }
      const node = overlayRef.current;
      const width = node?.clientWidth ?? 360;
      const height = node?.clientHeight ?? 520;
      const editorWidth = 248;
      const editorHeight = 172;
      const x = clamp(contextMenu.x, 8, Math.max(8, width - editorWidth));
      const y = clamp(contextMenu.y, 8, Math.max(8, height - editorHeight));
      setTextEditor({
        regionId: region.id,
        x,
        y,
        target,
        value:
          target === 'recognized'
            ? (region.recognizedText ?? '')
            : (region.translatedText ?? ''),
      });
      setContextMenu(null);
    },
    [contextMenu, editable, overlayRef],
  );

  const handleRegionContextMenu = useCallback(
    (event: React.MouseEvent<HTMLDivElement>, region: AioTextRegion) => {
      event.preventDefault();
      event.stopPropagation();
      onCardSelect();
      if (!selectionEnabled) return;
      onSelectRegion(region.id);
      const node = overlayRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const x = clamp(
        event.clientX - rect.left,
        6,
        Math.max(6, rect.width - 6),
      );
      const y = clamp(
        event.clientY - rect.top,
        6,
        Math.max(6, rect.height - 6),
      );
      setContextMenu({ regionId: region.id, x, y });
      setHoveredRegionId(region.id);
    },
    [onCardSelect, onSelectRegion, overlayRef, selectionEnabled],
  );

  const handleRegionDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>, region: AioTextRegion) => {
      event.preventDefault();
      event.stopPropagation();
      onCardSelect();
      if (!selectionEnabled) return;
      onSelectRegion(region.id);
      if (!editable) return;

      const node = overlayRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const editorWidth = 248;
      const editorHeight = 172;
      const x = clamp(
        event.clientX - rect.left,
        8,
        Math.max(8, rect.width - editorWidth),
      );
      const y = clamp(
        event.clientY - rect.top,
        8,
        Math.max(8, rect.height - editorHeight),
      );
      const hasTranslated = (region.translatedText ?? '').trim().length > 0;
      const target: EditableRegionTextTarget = hasTranslated
        ? 'translated'
        : 'recognized';
      setContextMenu(null);
      setTextEditor({
        regionId: region.id,
        x,
        y,
        target,
        value:
          target === 'recognized'
            ? (region.recognizedText ?? '')
            : (region.translatedText ?? ''),
      });
      setHoveredRegionId(region.id);
    },
    [editable, onCardSelect, onSelectRegion, overlayRef, selectionEnabled],
  );

  const handleContextCopyRecognized = useCallback(() => {
    if (!contextMenu) return;
    const region = regionsRef.current.find(
      (item) => item.id === contextMenu.regionId,
    );
    if (!region) return;
    void copyTextToClipboard(region.recognizedText ?? '');
    setContextMenu(null);
  }, [contextMenu, copyTextToClipboard]);

  const handleContextCopyTranslated = useCallback(() => {
    if (!contextMenu) return;
    const region = regionsRef.current.find(
      (item) => item.id === contextMenu.regionId,
    );
    if (!region) return;
    void copyTextToClipboard(region.translatedText ?? '');
    setContextMenu(null);
  }, [contextMenu, copyTextToClipboard]);

  const handleContextEditRecognized = useCallback(() => {
    openEditorForTarget('recognized');
  }, [openEditorForTarget]);

  const handleContextEditTranslated = useCallback(() => {
    openEditorForTarget('translated');
  }, [openEditorForTarget]);

  const handleContextRemoveRegion = useCallback(() => {
    if (!contextMenu || !editable) return;
    removeRegionById(contextMenu.regionId);
  }, [contextMenu, editable, removeRegionById]);

  const handleEditorSave = useCallback(() => {
    if (!textEditor) return;
    if (textEditor.target === 'recognized') {
      applyEditedRegionRecognizedText(textEditor.regionId, textEditor.value);
    } else {
      applyEditedRegionTranslation(textEditor.regionId, textEditor.value);
    }
    setTextEditor(null);
  }, [
    applyEditedRegionRecognizedText,
    applyEditedRegionTranslation,
    textEditor,
  ]);

  const handleEditorCancel = useCallback(() => {
    setTextEditor(null);
  }, []);

  const handleTextEditorChange = useCallback((nextValue: string) => {
    setTextEditor((prev) => (prev ? { ...prev, value: nextValue } : prev));
  }, []);

  const hoveredRegionTooltip = useMemo(
    () => {
      if (!hoveredRegionId) return null;
      const region = regionsRef.current.find((item) => item.id === hoveredRegionId);
      return region ? getTooltipContent(region) : null;
    },
    [getTooltipContent, hoveredRegionId],
  );

  const contextMenuTargetRegion = useMemo(
    () =>
      contextMenu?.regionId
        ? regionsRef.current.find((item) => item.id === contextMenu.regionId) ?? null
        : null,
    [contextMenu?.regionId],
  );

  return {
    hoveredRegionId,
    setHoveredRegionId,
    contextMenu,
    setContextMenu,
    textEditor,
    setTextEditor,
    hoveredRegionTooltip,
    contextMenuTargetRegion,
    handleTextEditorChange,
    handleRegionContextMenu,
    handleRegionDoubleClick,
    handleContextCopyRecognized,
    handleContextCopyTranslated,
    handleContextEditRecognized,
    handleContextEditTranslated,
    handleContextRemoveRegion,
    handleEditorSave,
    handleEditorCancel,
  };
};
