import { useCallback, useMemo, useState } from 'react';

import type { useI18n } from '../../../i18n';
import {
  bindTypographyPresetToMode,
  createTypographyFolder,
  createTypographyPreset,
  deleteTypographyFolder,
  deleteTypographyPreset,
  duplicateTypographyPreset,
  loadTypographyPresetState,
  renameTypographyFolder,
  setDefaultTypographyPreset,
  updateTypographyPreset,
} from '../../../typography/presets';
import type {
  TypographyPresetStateV1,
  TypographyStyleFolder,
  TypographyStylePreset,
} from '../../../typography/types';
import type { RenderTextStyle } from '../../../utils/renderText';
import { createEmptyTypographyPresetFormData } from '../settings.constants';
import type { TypographyPresetFormData } from '../settings.types';

type TranslationFn = ReturnType<typeof useI18n>['t'];

export interface UseTypographyPresetsArgs {
  t: TranslationFn;
}

export const useTypographyPresets = ({ t }: UseTypographyPresetsArgs) => {
  const [typographyPresetState, setTypographyPresetState] = useState<TypographyPresetStateV1>(() => loadTypographyPresetState());
  const [typographyPresetForm, setTypographyPresetForm] = useState<TypographyPresetFormData | null>(null);
  const [typographyPresetFeedback, setTypographyPresetFeedback] = useState<string | null>(null);
  const [typographyPresetError, setTypographyPresetError] = useState<string | null>(null);
  const [typographyNewFolderName, setTypographyNewFolderName] = useState("");
  const [typographyNewFolderParentId, setTypographyNewFolderParentId] = useState<string | null>(null);
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(new Set());
  const [folderRenameId, setFolderRenameId] = useState<string | null>(null);
  const [folderRenameName, setFolderRenameName] = useState("");

  const typographyPresetsByFolder = useMemo(() => {
    const map = new Map<string | null, TypographyStylePreset[]>();
    typographyPresetState.presets.forEach((preset) => {
      const bucket = map.get(preset.folderId ?? null);
      if (bucket) {
        bucket.push(preset);
      } else {
        map.set(preset.folderId ?? null, [preset]);
      }
    });
    map.forEach((value) => {
      value.sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
    });
    return map;
  }, [typographyPresetState.presets]);

  const openCreateTypographyPresetForm = useCallback(() => {
    setTypographyPresetForm(createEmptyTypographyPresetFormData());
    setTypographyPresetFeedback(null);
    setTypographyPresetError(null);
  }, []);

  const openEditTypographyPresetForm = useCallback((preset: TypographyStylePreset) => {
    setTypographyPresetForm({
      presetId: preset.id,
      folderId: preset.folderId,
      name: preset.name,
      description: preset.description,
      defaultShapeKind: preset.defaultShapeKind,
      padding: preset.padding,
      style: { ...preset.style },
    });
    setTypographyPresetFeedback(null);
    setTypographyPresetError(null);
  }, []);

  const handleTypographyPresetFieldChange = useCallback(<K extends keyof TypographyPresetFormData>(key: K, value: TypographyPresetFormData[K]) => {
    setTypographyPresetForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setTypographyPresetFeedback(null);
    setTypographyPresetError(null);
  }, []);

  const handleTypographyPresetStyleChange = useCallback(<K extends keyof RenderTextStyle>(key: K, value: RenderTextStyle[K]) => {
    setTypographyPresetForm((prev) => (prev ? {
      ...prev,
      style: {
        ...prev.style,
        [key]: value,
      },
    } : prev));
    setTypographyPresetFeedback(null);
    setTypographyPresetError(null);
  }, []);

  const handleSaveTypographyPreset = useCallback(() => {
    if (!typographyPresetForm) return;
    const trimmedName = typographyPresetForm.name.trim();
    if (!trimmedName) {
      setTypographyPresetError(t("settings.presets.typo.title"));
      return;
    }
    if (typographyPresetForm.presetId) {
      const updated = updateTypographyPreset(typographyPresetForm.presetId, typographyPresetForm, typographyPresetState);
      if (!updated.preset) {
        setTypographyPresetError(t("settings.presets.typo.title"));
        return;
      }
      setTypographyPresetState(updated.state);
      setTypographyPresetFeedback(t("settings.presets.typo.title"));
    } else {
      const created = createTypographyPreset(typographyPresetForm, typographyPresetState);
      setTypographyPresetState(created.state);
      setTypographyPresetFeedback(t("settings.presets.typo.title"));
    }
    setTypographyPresetForm(null);
    setTypographyPresetError(null);
  }, [typographyPresetForm, typographyPresetState, t]);

  const handleDeleteTypographyPreset = useCallback((preset: TypographyStylePreset) => {
    const confirmed = window.confirm(t("settings.presets.typo.title") + ` "${preset.name}"?`);
    if (!confirmed) return;
    const nextState = deleteTypographyPreset(preset.id, typographyPresetState);
    setTypographyPresetState(nextState);
    setTypographyPresetFeedback(t("settings.presets.typo.title"));
    setTypographyPresetError(null);
    setTypographyPresetForm((prev) => (prev?.presetId === preset.id ? null : prev));
  }, [typographyPresetState, t]);

  const handleDuplicateTypographyPreset = useCallback((preset: TypographyStylePreset) => {
    const duplicated = duplicateTypographyPreset(preset.id, typographyPresetState);
    if (!duplicated.preset) return;
    setTypographyPresetState(duplicated.state);
    setTypographyPresetFeedback(t("settings.presets.typo.title"));
    setTypographyPresetError(null);
  }, [typographyPresetState, t]);

  const handleCreateTypographyFolder = useCallback(() => {
    const trimmedName = typographyNewFolderName.trim();
    if (!trimmedName) return;
    const nextState = createTypographyFolder(trimmedName, typographyNewFolderParentId, typographyPresetState);
    setTypographyPresetState(nextState);
    setTypographyNewFolderName("");
    setTypographyNewFolderParentId(null);
    setTypographyPresetFeedback(t("settings.typographerLibrary.newFolder"));
    setTypographyPresetError(null);
  }, [typographyNewFolderName, typographyNewFolderParentId, typographyPresetState, t]);

  const handleDeleteTypographyFolder = useCallback((folder: TypographyStyleFolder) => {
    const childCount = typographyPresetState.folders.filter((f) => f.parentId === folder.id).length;
    const presetCount = typographyPresetState.presets.filter((p) => p.folderId === folder.id).length;
    const extra = childCount > 0 || presetCount > 0
      ? ` (${[childCount > 0 ? `${childCount} subfolder(s)` : "", presetCount > 0 ? `${presetCount} preset(s)` : ""].filter(Boolean).join(", ")} will be moved out of the folder)`
      : "";
    const confirmed = window.confirm(`Delete folder "${folder.name}"?${extra}`);
    if (!confirmed) return;
    const nextState = deleteTypographyFolder(folder.id, typographyPresetState);
    setTypographyPresetState(nextState);
    setCollapsedFolderIds((prev) => { const next = new Set(prev); next.delete(folder.id); return next; });
    setTypographyPresetFeedback(t("settings.typographerLibrary.newFolder"));
    setTypographyPresetError(null);
  }, [typographyPresetState, t]);

  const handleStartFolderRename = useCallback((folder: TypographyStyleFolder) => {
    setFolderRenameId(folder.id);
    setFolderRenameName(folder.name);
  }, []);

  const handleCommitFolderRename = useCallback((folderId: string) => {
    const trimmed = folderRenameName.trim();
    if (trimmed) {
      const nextState = renameTypographyFolder(folderId, trimmed, typographyPresetState);
      setTypographyPresetState(nextState);
    }
    setFolderRenameId(null);
    setFolderRenameName("");
  }, [folderRenameName, typographyPresetState]);

  const handleToggleFolderCollapse = useCallback((folderId: string) => {
    setCollapsedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }, []);

  const handleBindTypographyPreset = useCallback((modeKey: string, presetId: string | null) => {
    const nextState = bindTypographyPresetToMode(modeKey, presetId, typographyPresetState);
    setTypographyPresetState(nextState);
    setTypographyPresetFeedback(t("settings.typography.bindingsTitle"));
    setTypographyPresetError(null);
  }, [typographyPresetState, t]);

  const handleSetDefaultTypographyPreset = useCallback((presetId: string | null) => {
    const nextState = setDefaultTypographyPreset(presetId, typographyPresetState);
    setTypographyPresetState(nextState);
    setTypographyPresetFeedback(t("settings.typographerLibrary.defaultPreset"));
    setTypographyPresetError(null);
  }, [typographyPresetState, t]);

  return {
    typographyPresetState,
    typographyPresetForm,
    setTypographyPresetForm,
    typographyPresetFeedback,
    typographyPresetError,
    typographyNewFolderName,
    setTypographyNewFolderName,
    typographyNewFolderParentId,
    setTypographyNewFolderParentId,
    collapsedFolderIds,
    folderRenameId,
    setFolderRenameId,
    folderRenameName,
    setFolderRenameName,
    typographyPresetsByFolder,
    openCreateTypographyPresetForm,
    openEditTypographyPresetForm,
    handleTypographyPresetFieldChange,
    handleTypographyPresetStyleChange,
    handleSaveTypographyPreset,
    handleCreateTypographyFolder,
    handleDeleteTypographyFolder,
    handleStartFolderRename,
    handleCommitFolderRename,
    handleToggleFolderCollapse,
    handleDuplicateTypographyPreset,
    handleDeleteTypographyPreset,
    handleBindTypographyPreset,
    handleSetDefaultTypographyPreset,
  };
};
