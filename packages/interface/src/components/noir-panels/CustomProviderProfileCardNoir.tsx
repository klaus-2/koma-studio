'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, Pencil, Save, Settings2, Trash2, X } from 'lucide-react';
import { useI18n } from '../../i18n';

import type { CustomLlmProfile, CustomLlmProfileDraft, CustomLlmStage } from '../../utils/premiumAi';
import { requiresCustomLlmApiKey } from '../../utils/premiumAi';
import { NoirField, NoirInput } from '../noir/NoirPrimitives';
import { ProviderStatus, providerCardClass } from '../noir/noir-provider';

interface CustomProviderProfileCardProps {
  stage: CustomLlmStage;
  profile: CustomLlmProfile;
  selected: boolean;
  onUse: () => void;
  onTest: () => Promise<{ ok: boolean; message: string }>;
  onSave: (draft: CustomLlmProfileDraft) => Promise<void> | void;
  onDelete: () => void;
}

export const CustomProviderProfileCard = ({
  stage,
  profile,
  selected,
  onUse,
  onTest,
  onSave,
  onDelete,
}: CustomProviderProfileCardProps) => {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<CustomLlmProfileDraft>({
    id: profile.id,
    label: profile.label,
    apiBase: profile.apiBase,
    apiKey: profile.apiKey,
    model: profile.model,
  });
  const [saving, setSaving] = useState(false);
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isEditing) return;
    setDraft({
      id: profile.id,
      label: profile.label,
      apiBase: profile.apiBase,
      apiKey: profile.apiKey,
      model: profile.model,
    });
  }, [isEditing, profile.apiBase, profile.apiKey, profile.id, profile.label, profile.model]);

  const canSave = useMemo(
    () =>
      draft.label.trim().length > 0
      && draft.apiBase.trim().length > 0
      && draft.model.trim().length > 0
      && (!requiresCustomLlmApiKey(draft.apiBase) || draft.apiKey.trim().length > 0),
    [draft.apiBase, draft.apiKey, draft.label, draft.model],
  );

  const handleCancel = () => {
    setDraft({
      id: profile.id,
      label: profile.label,
      apiBase: profile.apiBase,
      apiKey: profile.apiKey,
      model: profile.model,
    });
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onSave(draft);
      setIsEditing(false);
    } catch {
      // Parent already exposes a user-facing status message.
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTestRunning(true);
    setTestResult(null);
    try {
      const result = await onTest();
      setTestResult(result);
    } catch (error) {
      setTestResult({
        ok: false,
        message: error instanceof Error ? error.message : 'Failed to test provider configuration.',
      });
    } finally {
      setTestRunning(false);
    }
  };

  const stageLabelText = stage === 'translation' ? t('freeProviderCard.stage.translation') : t('freeProviderCard.stage.ocr');

  return (
    <article className={providerCardClass(expanded)}>
      {/* ── Header ── */}
      <header
        className="flex cursor-pointer items-center gap-3 px-3.5 py-3"
        onClick={() => setExpanded((p) => !p)}
      >
        <span className="panel-cut-sm grid h-8 w-8 flex-none place-items-center border border-azure/40 bg-azure/10 text-azure">
          <Settings2 size={13} />
        </span>

        <div className="min-w-0 flex-1">
          <h4 className="truncate font-display text-[12.5px] font-extrabold uppercase tracking-wide text-paper">
            {profile.label}
          </h4>
          <p className="truncate font-mono text-[9px] uppercase tracking-[0.14em] text-paper/40">
            {stageLabelText} · {profile.model || t('customProvider.badge.customProfile')}
          </p>
        </div>

        <div className="flex flex-none items-center gap-1.5">
          <span className="panel-cut-sm border border-gold/50 bg-gold/10 px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-gold">
            {t('customProvider.badge.customProfile')}
          </span>
          {selected && (
            <span className="panel-cut-sm inline-flex items-center gap-1 border border-mint/50 bg-mint/10 px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-mint">
              <CheckCircle2 size={9} /> {t('customProvider.status.active')}
            </span>
          )}
          <ChevronDown
            size={13}
            aria-hidden
            className={`text-paper/40 transition-transform duration-300 ${expanded ? 'rotate-180 text-crimson' : ''}`}
          />
        </div>
      </header>

      {/* ── Body ── */}
      {expanded && (
        <div className="flex flex-col gap-3.5 border-t border-paper/10 p-3.5">
          <div className="grid gap-3 sm:grid-cols-2">
            <NoirField label={t('customProvider.field.name')}>
              <NoirInput
                type="text"
                value={draft.label}
                readOnly={!isEditing}
                onChange={(e) => setDraft((prev) => ({ ...prev, label: e.target.value }))}
              />
            </NoirField>
            <NoirField label={t('customProvider.field.model')}>
              <NoirInput
                type="text"
                value={draft.model}
                readOnly={!isEditing}
                onChange={(e) => setDraft((prev) => ({ ...prev, model: e.target.value }))}
              />
            </NoirField>
            <NoirField label={t('customProvider.field.apiBase')}>
              <NoirInput
                type="text"
                value={draft.apiBase}
                readOnly={!isEditing}
                onChange={(e) => setDraft((prev) => ({ ...prev, apiBase: e.target.value }))}
              />
            </NoirField>
            <NoirField label={t('customProvider.field.apiKey')}>
              <NoirInput
                type={isEditing ? 'text' : 'password'}
                value={draft.apiKey || ''}
                placeholder={isEditing ? t('customProvider.placeholder.pasteKey') : t('customProvider.placeholder.noKey')}
                readOnly={!isEditing}
                onChange={(e) => setDraft((prev) => ({ ...prev, apiKey: e.target.value }))}
              />
            </NoirField>
          </div>

          {testResult && (
            <ProviderStatus ok={testResult.ok}>
              {testResult.ok ? <CheckCircle2 size={12} className="mt-0.5 flex-none" /> : <AlertCircle size={12} className="mt-0.5 flex-none" />}{' '}
              {testResult.message}
            </ProviderStatus>
          )}

          {isEditing ? (
            <div className="flex flex-wrap justify-end gap-2 border-t border-paper/8 pt-3">
              <button type="button" className="btn-ghost" onClick={handleCancel} disabled={saving}>
                <X size={12} /> {t('customProvider.action.cancel')}
              </button>
              <button type="button" className="btn-primary !py-2 !text-[11px]" onClick={handleSave} disabled={!canSave || saving}>
                <Save size={12} /> {saving ? t('customProvider.action.saving') : t('customProvider.action.save')}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap justify-end gap-2 border-t border-paper/8 pt-3">
              <button
                type="button" className="btn-ghost"
                onClick={() => void handleTest()}
                disabled={testRunning}
              >
                {testRunning ? t('freeProviderCard.actions.testing') : t('freeProviderCard.actions.testApi')}
              </button>
              <button type="button" className="btn-ghost" onClick={() => setIsEditing(true)}>
                <Pencil size={12} /> {t('customProvider.action.edit')}
              </button>
              <button type="button" className="btn-ghost hover:!border-crimson/50 hover:!text-crimson" onClick={onDelete}>
                <Trash2 size={12} /> {t('customProvider.action.delete')}
              </button>
              <button type="button" className="btn-primary !py-2 !text-[11px]" onClick={onUse}>
                {t('customProvider.action.use')}
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
};

export default CustomProviderProfileCard;
