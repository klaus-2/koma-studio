import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, Pencil, Save, Settings2, Trash2, X } from "lucide-react";
import { useI18n } from "../../i18n";

import type { CustomLlmProfile, CustomLlmProfileDraft, CustomLlmStage } from "../../utils/customLlm";
import { requiresCustomLlmApiKey } from "../../utils/customLlm";
import styles from "./styles.module.css";

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

  const stageLabelText = stage === "translation" ? t("freeProviderCard.stage.translation") : t("freeProviderCard.stage.ocr");

  return (
    <article className={`${styles.card} ${styles.compact} ${expanded ? styles.cardExpanded : ""}`}>
      {/* ── Always-visible header row ── */}
      <header className={styles.header} onClick={() => setExpanded((p) => !p)}>
        <div className={styles.headerIcon} style={{ background: 'rgba(168, 85, 247, 0.1)' }}>
          <Settings2 size={14} style={{ color: '#c084fc' }} />
        </div>

        <div className={styles.headerInfo}>
          <h4 className={styles.title}>{profile.label}</h4>
          <p className={styles.meta}>
            {stageLabelText} · {profile.model || t("customProvider.badge.customProfile")}
          </p>
        </div>

        <div className={styles.headerRight}>
          <span className={styles.badgeIntegrated}>{t("customProvider.badge.customProfile")}</span>

          {selected && (
            <span className={styles.activeChip}>
              <CheckCircle2 size={9} /> {t("customProvider.status.active")}
            </span>
          )}

          <ChevronDown
            size={14}
            className={`${styles.chevron} ${expanded ? styles.chevronOpen : ""}`}
          />
        </div>
      </header>

      {/* ── Collapsible config body ── */}
      {expanded && (
        <div className={styles.body}>
          <div className={styles.fieldGrid}>
            <div className={styles.field}>
              <label>{t("customProvider.field.name")}</label>
              <input
                type="text"
                value={draft.label}
                className={styles.input}
                readOnly={!isEditing}
                onChange={(event) => setDraft((prev) => ({ ...prev, label: event.target.value }))}
              />
            </div>

            <div className={styles.field}>
              <label>{t("customProvider.field.model")}</label>
              <input
                type="text"
                value={draft.model}
                className={styles.input}
                readOnly={!isEditing}
                onChange={(event) => setDraft((prev) => ({ ...prev, model: event.target.value }))}
              />
            </div>

            <div className={styles.field}>
              <label>{t("customProvider.field.apiBase")}</label>
              <input
                type="text"
                value={draft.apiBase}
                className={styles.input}
                readOnly={!isEditing}
                onChange={(event) => setDraft((prev) => ({ ...prev, apiBase: event.target.value }))}
              />
            </div>

            <div className={styles.field}>
              <label>{t("customProvider.field.apiKey")}</label>
              <input
                type={isEditing ? "text" : "password"}
                value={draft.apiKey || ""}
                className={styles.input}
                placeholder={isEditing ? t("customProvider.placeholder.pasteKey") : t("customProvider.placeholder.noKey")}
                readOnly={!isEditing}
                onChange={(event) => setDraft((prev) => ({ ...prev, apiKey: event.target.value }))}
              />
            </div>
          </div>

          {testResult ? (
            <p className={testResult.ok ? styles.statusOk : styles.statusWarn} role={testResult.ok ? 'status' : 'alert'}>
              {testResult.ok ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />} {testResult.message}
            </p>
          ) : null}

          {isEditing ? (
            <div className={styles.actions}>
              <button type="button" className={styles.secondaryButton} onClick={handleCancel} disabled={saving}>
                <X size={12} /> {t("customProvider.action.cancel")}
              </button>
              <button type="button" className={styles.primaryButton} onClick={handleSave} disabled={!canSave || saving}>
                <Save size={12} /> {saving ? t("customProvider.action.saving") : t("customProvider.action.save")}
              </button>
            </div>
          ) : (
            <div className={styles.actions}>
              <button type="button" className={styles.secondaryButton} onClick={() => void handleTest()} disabled={testRunning}>
                {testRunning ? 'Testing...' : 'Test API'}
              </button>
              <button type="button" className={styles.secondaryButton} onClick={() => setIsEditing(true)}>
                <Pencil size={12} /> {t("customProvider.action.edit")}
              </button>
              <button type="button" className={styles.secondaryButton} onClick={onDelete}>
                <Trash2 size={12} /> {t("customProvider.action.delete")}
              </button>
              <button type="button" className={styles.primaryButton} onClick={onUse}>
                {t("customProvider.action.use")}
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
};

export default CustomProviderProfileCard;
