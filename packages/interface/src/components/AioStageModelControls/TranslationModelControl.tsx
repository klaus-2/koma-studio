import { AlertTriangle, HardDrive, Lock, ShieldAlert } from "lucide-react";
import { memo, useMemo } from "react";

import { TRANSLATION_SERVICE_BACKEND_KEYS } from "../../models/aioStageCatalog";
import { modelSupportsLanguage, isDownloadOnlyModel, TRANSLATION_MODELS_REGISTRY } from "../../models/translation-models-registry";
import type { ModelInstallState } from "../../models/types";
import type { StageModelRefusalDetail } from "../../aio-stages/transport";
import { useI18n } from "../../i18n";
import type { LegacyTranslationOption } from "./types";
import { useStageControlTokens } from "./stageControlTokens";
import styles from "./styles.module.css";

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
  /** Structured backend refusal for the current selection (warn, never block). */
  refusal?: StageModelRefusalDetail | null;
  /** Switches the persisted selection to the stage's default model (user consent only). */
  onUseDefaultModel?: () => void;
  onSelectModel: (modelId: string) => void;
  onOpenManager: (args?: { language?: string; focusedModelId?: string | null }) => void;
}

const TranslationModelControlBase = ({
  selectedModelId,
  sourceLanguage,
  targetLanguage,
  entries,
  legacyOptions,
  installedCount,
  updatesCount,
  selectedSummary,
  supportSummary,
  refusal = null,
  onUseDefaultModel,
  onSelectModel,
  onOpenManager,
}: TranslationModelControlProps) => {
  const { t } = useI18n();
  const tokens = useStageControlTokens();

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
        if (isDownloadOnlyModel(model)) return false;
        const entry = entries[model.id];
        if (!entry) return false;
        return (
          entry.status === "installed" || entry.status === "update_available"
        );
      }),
    [compatibleLocalModels, entries],
  );

  const downloadOnlyLocalModels = useMemo(
    () => compatibleLocalModels.filter(isDownloadOnlyModel),
    [compatibleLocalModels],
  );

  const listedLegacyOptions = useMemo(
    () =>
      legacyOptions.filter(
        (option) =>
          !localModelIds.has(option.key) &&
          option.implemented &&
          // Configurable services (DeepL, LibreTranslate) stay listed even
          // unconfigured: the label marks them and running one surfaces the
          // structured refusal naming what to set up (warn-not-block).
          (option.available ||
            option.key in TRANSLATION_SERVICE_BACKEND_KEYS),
      ),
    [legacyOptions, localModelIds],
  );

  const selectedValue =
    availableLocalModels.some((model) => model.id === selectedModelId) ||
      listedLegacyOptions.some((option) => option.key === selectedModelId)
      ? selectedModelId
      : "";

  const hasSelectableOptions =
    availableLocalModels.length > 0 || listedLegacyOptions.length > 0;
  const hasAnyOptions =
    hasSelectableOptions || downloadOnlyLocalModels.length > 0;

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
          className={tokens.manageButton}
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
        className={tokens.select}
        disabled={!hasAnyOptions}
      >
        {!hasAnyOptions ? (
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
            {listedLegacyOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {`${t("toolbar.modelSelect.cloudPrefix")} ${option.name}${
                  option.available
                    ? ""
                    : ` — ${t("toolbar.modelSelect.notConfigured")}`
                }`}
              </option>
            ))}
            {downloadOnlyLocalModels.map((model) => (
              <option key={model.id} value={model.id} disabled>
                {`${t("toolbar.modelSelect.localPrefix")} ${model.name} — ${t("modelCard.badge.downloadOnly")}`}
              </option>
            ))}
          </>
        )}
      </select>

      {refusal ? (
        <div className={styles.refusalNotice} role="alert">
          <p className={styles.refusalTitle}>
            <ShieldAlert size={13} aria-hidden="true" />
            {refusal.code === "UNKNOWN_MODEL"
              ? t("modelCatalog.error.unknownModel")
              : refusal.code === "MODEL_NOT_CONFIGURED"
                ? t("modelCatalog.error.notConfigured")
                : t("modelCatalog.error.notImplemented")}
          </p>
          <p className="koma-field__hint">{refusal.modelKey}</p>
          <p className="koma-field__hint">
            {t("modelCatalog.error.availableModels")}:{" "}
            {refusal.availableKeys.join(", ") || "-"}
          </p>
          {onUseDefaultModel ? (
            <button
              type="button"
              className={tokens.manageButton}
              onClick={onUseDefaultModel}
            >
              {t("modelCatalog.error.useDefault")}
            </button>
          ) : null}
        </div>
      ) : null}

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

      {!hasAnyOptions ? (
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

export const TranslationModelControl = memo(TranslationModelControlBase);

export default TranslationModelControl;
