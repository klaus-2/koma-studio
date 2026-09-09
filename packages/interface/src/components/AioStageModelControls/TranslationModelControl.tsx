import { AlertTriangle, HardDrive, Lock } from "lucide-react";
import { useMemo } from "react";

import { modelSupportsLanguage, TRANSLATION_MODELS_REGISTRY } from "../../models/translation-models-registry";
import type { ModelInstallState } from "../../models/types";
import type { LlmCapabilities } from "../../utils/customLlm";
import { useI18n } from "../../i18n";
import styles from "./styles.module.css";

interface LegacyTranslationOption {
  key: string;
  name: string;
  available: boolean;
  implemented: boolean;
  provider_id?: string;
  provider_name?: string;
  provider_status?: "integrated" | "catalog_only";
  requires_user_api_key?: boolean;
  default_api_base?: string;
  default_model?: string;
  docs_url?: string;
  limits_summary?: string;
  rate_limit_summary?: string;
  setup_summary?: string;
  llm_capabilities?: LlmCapabilities;
}

interface TranslationModelControlProps {
  selectedModelId: string;
  sourceLanguage: string;
  targetLanguage: string;
  entries: Record<string, ModelInstallState>;
  legacyOptions: LegacyTranslationOption[];
  installedCount: number;
  updatesCount: number;
  selectedSummary: string;
  supportSummary: string;
  onSelectModel: (modelId: string) => void;
  onOpenManager: (args?: { language?: string; focusedModelId?: string | null }) => void;
}

export const TranslationModelControl = ({
  selectedModelId,
  sourceLanguage,
  targetLanguage,
  entries,
  legacyOptions,
  installedCount,
  updatesCount,
  selectedSummary,
  supportSummary,
  onSelectModel,
  onOpenManager,
}: TranslationModelControlProps) => {
  const { t } = useI18n();

  const compatibleLocalModels = useMemo(
    () =>
      TRANSLATION_MODELS_REGISTRY.filter((model) =>
        modelSupportsLanguage(model, sourceLanguage, targetLanguage),
      ),
    [sourceLanguage, targetLanguage],
  );
  const localModelIds = useMemo(
    () => new Set(compatibleLocalModels.map((model) => model.id)),
    [compatibleLocalModels],
  );

  const availableLocalModels = useMemo(
    () =>
      compatibleLocalModels.filter((model) => {
        const entry = entries[model.id];
        if (!entry) return false;
        return (
          entry.status === "installed" || entry.status === "update_available"
        );
      }),
    [compatibleLocalModels, entries],
  );

  const availableLegacyOptions = useMemo(
    () =>
      legacyOptions.filter(
        (option) =>
          !localModelIds.has(option.key) &&
          option.implemented &&
          option.available,
      ),
    [legacyOptions, localModelIds],
  );

  const selectedValue =
    availableLocalModels.some((model) => model.id === selectedModelId) ||
    availableLegacyOptions.some((option) => option.key === selectedModelId)
      ? selectedModelId
      : "";

  const selectedLocalModel = TRANSLATION_MODELS_REGISTRY.find(
    (model) => model.id === selectedModelId,
  );
  const selectedModelIncompatible =
    selectedLocalModel &&
    !modelSupportsLanguage(selectedLocalModel, sourceLanguage, targetLanguage);

  return (
    <div className="koma-stage-config">
      <div className={styles.headerRow}>
        <label className="koma-field__label">{t("aio.stage.getTranslations")}</label>
        <button
          type="button"
          className={styles.manageButton}
          onClick={() => onOpenManager({ language: sourceLanguage, focusedModelId: selectedModelId || null })}
        >
          <HardDrive size={12} /> {t("aio.model.manage")}
        </button>
      </div>

      {selectedModelIncompatible ? (
        <div className={styles.compatibilityWarning}>
          <AlertTriangle size={14} />
          <span>
            {t("toolbar.modelSelect.incompatibleWarning", {
              model: selectedLocalModel.name,
              source: sourceLanguage.toUpperCase(),
              target: targetLanguage.toUpperCase(),
            })}
          </span>
        </div>
      ) : null}

      <select
        value={selectedValue}
        onChange={(event) => onSelectModel(event.target.value)}
        className="koma-select"
        disabled={availableLocalModels.length === 0 && availableLegacyOptions.length === 0}
      >
        {availableLocalModels.length === 0 && availableLegacyOptions.length === 0 ? (
          <option value="" disabled>
            {t("toolbar.modelSelect.emptyState", {
              source: sourceLanguage.toUpperCase(),
              target: targetLanguage.toUpperCase(),
            })}
          </option>
        ) : (
          <>
            <option value="" disabled>
              {t("toolbar.modelSelect.select")}
            </option>
            {availableLocalModels.map((model) => {
              const entry = entries[model.id];
              const updateSuffix =
                entry?.status === "update_available"
                  ? ` ${t("toolbar.modelSelect.updateAvailable")}`
                  : "";
              return (
                <option key={model.id} value={model.id}>
                  {`${t("toolbar.modelSelect.localPrefix")} ${model.name}${updateSuffix}`}
                </option>
              );
            })}
            {availableLegacyOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {`${t("toolbar.modelSelect.cloudPrefix")} ${option.name}`}
              </option>
            ))}
          </>
        )}
      </select>

      <p className="koma-field__hint">{selectedSummary}</p>
      <p className="koma-field__hint">{supportSummary}</p>

      <p className="koma-field__hint">
        {installedCount === 1
          ? t("toolbar.modelSelect.installedCount_one", { count: installedCount })
          : t("toolbar.modelSelect.installedCount_other", { count: installedCount })}
        {" · "}
        {updatesCount > 0
          ? updatesCount === 1
            ? t("toolbar.modelSelect.updates_one", { count: updatesCount })
            : t("toolbar.modelSelect.updates_other", { count: updatesCount })
          : t("toolbar.modelSelect.noUpdates")}
      </p>

      {availableLocalModels.length === 0 && availableLegacyOptions.length === 0 ? (
        <div className={styles.emptyState}>
          <Lock size={14} />
          {t("toolbar.modelSelect.emptyState", {
            source: sourceLanguage.toUpperCase(),
            target: targetLanguage.toUpperCase(),
          })}
        </div>
      ) : null}
    </div>
  );
};

export default TranslationModelControl;
