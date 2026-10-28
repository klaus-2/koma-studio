import { memo } from 'react';

import { AIO_PRESET_STAGE_KEYS } from '../../../constants/dashboard.constants';
import { useI18n } from '../../../i18n';
import type { AioStageOption } from '../../../models/aioStageCatalog';
import type { AioStageKey } from '../../../types/aioModelPresets';
import type { AioPresetEditorDraft } from '../../../types/dashboard.types';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { aioPanelClasses } from './AioRightPanel.skin';

interface PresetEditorStageOptions {
  detectText: AioStageOption[];
  recognizeText: AioStageOption[];
  getTranslations: AioStageOption[];
  segmentText: AioStageOption[];
  cleanImage: AioStageOption[];
}

interface AioPresetEditorFormProps {
  noir: boolean;
  presetEditorStageOptions: PresetEditorStageOptions;
  aioStageLabels: Record<AioStageKey, string>;
  formatAioStageOptionLabel: (option: AioStageOption) => string;
  normalizedAioSourceLanguage: string;
  onClose: () => void;
  onSave: () => void;
}

// Isolated island: keystrokes re-render this form, not the panel or dashboard.
export default memo(function AioPresetEditorForm({
  noir,
  presetEditorStageOptions,
  aioStageLabels,
  formatAioStageOptionLabel,
  normalizedAioSourceLanguage,
  onClose,
  onSave,
}: AioPresetEditorFormProps) {
  const { t } = useI18n();
  const skin = aioPanelClasses(noir);
  const draft = useAioPipelineStore((s) => s.aioPresetEditorDraft);
  const setDraft = useAioPipelineStore((s) => s.setAioPresetEditorDraft);

  const setDraftField = <K extends keyof AioPresetEditorDraft>(
    field: K,
    value: AioPresetEditorDraft[K],
  ): void => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="koma-aio-preset-editor">
      <div className="koma-aio-preset-editor__grid">
        <label className="koma-field">
          <span className="koma-field__label">{t('dashboard.aio.customAi.name')}</span>
          <input
            type="text"
            className="koma-input"
            value={draft.name}
            onChange={(e) => setDraftField('name', e.target.value)}
            placeholder={t('dashboard.aio.presets.namePlaceholder')}
          />
        </label>
        <label className="koma-field">
          <span className="koma-field__label">{t('dashboard.aio.presets.description')}</span>
          <input
            type="text"
            className="koma-input"
            value={draft.description}
            onChange={(e) => setDraftField('description', e.target.value)}
            placeholder={t('dashboard.aio.presets.optional')}
          />
        </label>
      </div>
      <div className="koma-aio-preset-editor__stages">
        {AIO_PRESET_STAGE_KEYS.map((stageKey) => {
          const stageOptions = presetEditorStageOptions[stageKey];
          const selectedModel = draft.stageModels[stageKey];
          return (
            <label key={stageKey} className="koma-field">
              <span className="koma-field__label">
                {aioStageLabels[stageKey]}
              </span>
              <select
                className={skin.select}
                value={selectedModel}
                disabled={stageOptions.length === 0}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    stageModels: {
                      ...prev.stageModels,
                      [stageKey]: e.target.value,
                    },
                  }))
                }
              >
                {stageOptions.length === 0 && (
                  <option value="">{t('aio.model.noneAvailable')}</option>
                )}
                {stageOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {formatAioStageOptionLabel(opt)}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
      <label className="koma-checklist__item">
        <input
          type="checkbox"
          checked={draft.setAsActive}
          onChange={(e) => setDraftField('setAsActive', e.target.checked)}
        />
        <span>
          {t('dashboard.aio.presets.setActiveFor')}{' '}
          {normalizedAioSourceLanguage.toUpperCase()}
        </span>
      </label>
      <div className="koma-aio-preset-editor__footer">
        <button
          type="button"
          className="koma-btn koma-btn--ghost koma-btn--sm"
          onClick={onClose}
        >
          {t('dashboard.aio.presets.cancel')}
        </button>
        <button
          type="button"
          className="koma-btn koma-btn--primary koma-btn--sm"
          onClick={onSave}
        >
          {draft.presetId
            ? t('dashboard.aio.presets.update')
            : t('dashboard.aio.presets.create')}
        </button>
      </div>
    </div>
  );
});
