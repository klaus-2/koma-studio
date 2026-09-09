import { useMemo, useState } from "react";
import { AlertCircle, Check, CheckCircle2, ChevronDown, ChevronsUpDown, ExternalLink, Info, Zap } from "lucide-react";
import { useI18n } from "../../i18n";

import type {
  FreeAiProviderCatalogEntry,
  FreeProviderAccessType,
  FreeProviderDraftValue,
  FreeProviderStage,
  FreeProviderStageDefinition,
} from "../../models/freeAiProviderCatalog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@koma/ui/components/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@koma/ui/components/popover";
import ResourceExternalAnchor from "../resources/ResourceExternalAnchor";
import styles from "./styles.module.css";

interface FreeProviderCardProps {
  provider: FreeAiProviderCatalogEntry;
  stage: FreeProviderStage;
  definition: FreeProviderStageDefinition;
  draft: FreeProviderDraftValue;
  selectedProfileLabel: string | null;
  compact?: boolean;
  onChange: (patch: Partial<FreeProviderDraftValue>) => void;
  onSave: () => void;
  onUse: () => void;
  onTest: () => Promise<{ ok: boolean; message: string }>;
}

export const FreeProviderCard = ({
  provider,
  stage,
  definition,
  draft,
  selectedProfileLabel,
  compact = false,
  onChange,
  onSave,
  onUse,
  onTest,
}: FreeProviderCardProps) => {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);

  const stageLabelText = stage === "translation" ? t("freeProviderCard.stage.translation") : stage === "clean" ? t("freeProviderCard.stage.clean") : t("freeProviderCard.stage.ocr");
  const isIntegrated = provider.status === "integrated";
  const requiresKey = definition.requiresUserApiKey;
  const modelInputListId = `free-provider-models-${provider.id}-${stage}`;
  const useCustomModelInput = Boolean(definition.allowCustomModelInput);
  const selectedModelDefinition = definition.models.find((model) => model.apiModel === draft.model) ?? null;
  const selectedModelLabel = selectedModelDefinition?.label ?? draft.model;
  const selectedModelAccessBadge = selectedModelDefinition?.accessBadgeLabel ?? null;
  const selectedModelAccessType = selectedModelDefinition?.accessType ?? null;
  const selectedModelRateLimit = selectedModelDefinition?.rateLimitSummary ?? provider.rateLimitSummary;
  const shouldShowProviderAccessBadge = Boolean(
    provider.accessBadgeLabel
    && (provider.accessBadgeLabel !== selectedModelAccessBadge || provider.accessType !== selectedModelAccessType),
  );
  const stageModels = useMemo(() => definition.models, [definition.models]);
  const configSummary = (definition.configFields ?? [])
    .map((field) => {
      const rawValue = String(draft.params?.[field.id] ?? "").trim();
      if (!rawValue) return `${field.label}: ${t("freeProviderCard.empty")}`;
      return `${field.label}: ${rawValue}`;
    })
    .join(" | ");
  const missingRequiredParams = (definition.configFields ?? []).some(
    (field) => field.required && !String(draft.params?.[field.id] ?? "").trim(),
  );
  const missingRequiredInput =
    !draft.model.trim()
    || !draft.apiBase.trim()
    || missingRequiredParams
    || (requiresKey && !draft.apiKey.trim());

  const getAccessBadgeClassName = (accessType: FreeProviderAccessType | null | undefined): string => {
    switch (accessType) {
      case "free":
        return styles.badgeAccessFree ?? "";
      case "trial":
        return styles.badgeAccessTrial ?? "";
      case "credit":
        return styles.badgeAccessCredit ?? "";
      case "copilot":
        return styles.badgeAccessCopilot ?? "";
      case "paid":
        return styles.badgeAccessPaid ?? "";
      case "mixed":
        return styles.badgeAccessMixed ?? "";
      default:
        return styles.badgeAccessUnknown ?? "";
    }
  };

  const handleTest = async (): Promise<void> => {
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

  return (
    <article className={`${styles.card} ${compact ? styles.compact : ""} ${expanded ? styles.cardExpanded : ""}`}>
      {/* ── Always-visible header row ── */}
      <header className={styles.header} onClick={() => setExpanded((p) => !p)}>
        <div className={styles.headerIcon}>
          <Zap size={14} />
        </div>

        <div className={styles.headerInfo}>
          <h4 className={styles.title}>{provider.name}</h4>
          <p className={styles.meta}>
            {stageLabelText} · {selectedModelLabel || t("freeProviderCard.info.notSelected")}
          </p>
        </div>

        <div className={styles.headerRight}>
          <span className={isIntegrated ? styles.badgeIntegrated : styles.badgeCatalog}>
            {isIntegrated ? t("freeProviderCard.badge.integrated") : t("freeProviderCard.badge.catalog")}
          </span>

          {shouldShowProviderAccessBadge ? (
            <span className={`${styles.badgeAccess} ${getAccessBadgeClassName(provider.accessType)}`}>
              {provider.accessBadgeLabel}
            </span>
          ) : null}

          {selectedModelAccessBadge ? (
            <span className={`${styles.badgeModelAccess} ${getAccessBadgeClassName(selectedModelAccessType)}`}>
              {selectedModelAccessBadge}
            </span>
          ) : null}

          {selectedProfileLabel && (
            <span className={styles.activeChip}>
              <CheckCircle2 size={9} /> {selectedProfileLabel}
            </span>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={styles.infoButton}
                  aria-label={t("freeProviderCard.info.tooltip", { name: provider.name })}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Info size={11} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className={styles.tooltip}>
                <div className={styles.tooltipTitle}>{provider.name}</div>
                <p className={styles.tooltipLine}>
                  <strong>{t("freeProviderCard.info.selectedModel")}</strong> {selectedModelLabel || t("freeProviderCard.info.notSelected")}
                </p>
                <p className={styles.tooltipLine}>
                  <strong>{t("freeProviderCard.info.modelId")}</strong> {draft.model || t("freeProviderCard.info.notDefined")}
                </p>
                <p className={styles.tooltipLine}>
                  <strong>{t("freeProviderCard.info.apiBase")}</strong> {draft.apiBase || definition.defaultApiBase}
                </p>
                <p className={styles.tooltipLine}>
                  <strong>{t("freeProviderCard.info.apiKey")}</strong> {draft.apiKey.trim() ? t("freeProviderCard.info.configured") : (requiresKey ? t("freeProviderCard.info.required") : t("freeProviderCard.info.optional"))}
                </p>
                {configSummary ? (
                  <p className={styles.tooltipLine}>
                    <strong>{t("freeProviderCard.info.extraFields")}</strong> {configSummary}
                  </p>
                ) : null}
                {provider.accessSummary ? (
                  <p className={styles.tooltipLine}>
                    <strong>Access:</strong> {provider.accessSummary}
                  </p>
                ) : null}
                {selectedModelAccessBadge ? (
                  <p className={styles.tooltipLine}>
                    <strong>Model access:</strong> {selectedModelAccessBadge}
                  </p>
                ) : null}
                {selectedModelRateLimit ? (
                  <p className={styles.tooltipLine}>
                    <strong>Model limits:</strong> {selectedModelRateLimit}
                  </p>
                ) : null}
                {provider.verificationNotice ? (
                  <p className={styles.tooltipLine}>
                    <strong>Verification:</strong> {provider.verificationNotice}
                  </p>
                ) : null}
                {provider.dataPolicyNotice ? (
                  <p className={styles.tooltipLine}>
                    <strong>Data policy:</strong> {provider.dataPolicyNotice}
                  </p>
                ) : null}
                <p className={styles.tooltipLine}><strong>{t("freeProviderCard.info.setup")}</strong> {provider.setupSummary}</p>
                <p className={styles.tooltipLine}><strong>{t("freeProviderCard.info.limits")}</strong> {provider.limitsSummary}</p>
                <p className={styles.tooltipLine}><strong>{t("freeProviderCard.info.rateLimits")}</strong> {provider.rateLimitSummary}</p>
                <p className={styles.tooltipLine}><strong>{t("freeProviderCard.info.modelsInStage")}</strong> {definition.models.length}</p>
                <div className={styles.tooltipLinks}>
                  <ResourceExternalAnchor href={provider.setupUrl}>
                    {t('freeProviderCard.setup')} <ExternalLink size={10} />
                  </ResourceExternalAnchor>
                  <ResourceExternalAnchor href={provider.limitsUrl}>
                    {t('freeProviderCard.limits')} <ExternalLink size={10} />
                  </ResourceExternalAnchor>
                  <ResourceExternalAnchor href={provider.rateLimitsUrl}>
                    {t('freeProviderCard.rateLimits')} <ExternalLink size={10} />
                  </ResourceExternalAnchor>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <ChevronDown
            size={14}
            className={`${styles.chevron} ${expanded ? styles.chevronOpen : ""}`}
          />
        </div>
      </header>

      {/* ── Collapsible config body ── */}
      {expanded && (
        <div className={styles.body}>
          {(provider.accessSummary || selectedModelAccessBadge || selectedModelRateLimit) ? (
            <div className={styles.modelFacts}>
              {shouldShowProviderAccessBadge ? (
                <span className={`${styles.badgeAccess} ${getAccessBadgeClassName(provider.accessType)}`}>
                  {provider.accessBadgeLabel}
                </span>
              ) : null}
              {selectedModelAccessBadge ? (
                <span className={`${styles.badgeModelAccess} ${getAccessBadgeClassName(selectedModelAccessType)}`}>
                  {selectedModelAccessBadge}
                </span>
              ) : null}
              <div className={styles.modelFactsText}>
                {provider.accessSummary ? <p>{provider.accessSummary}</p> : null}
                {selectedModelRateLimit ? <p>{selectedModelRateLimit}</p> : null}
              </div>
            </div>
          ) : null}

          <div className={styles.fieldGrid}>
            {/* Model selector */}
            <div className={`${styles.field} ${styles.fieldFull}`}>
              <label>{t("freeProviderCard.field.model")}</label>
              <Popover open={modelPickerOpen} onOpenChange={setModelPickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={styles.modelPickerTrigger}
                    aria-expanded={modelPickerOpen}
                    aria-controls={modelInputListId}
                  >
                    <div className={styles.modelPickerTriggerText}>
                      <span className={styles.modelPickerTitle}>
                        {selectedModelLabel || t("freeProviderCard.info.notSelected")}
                      </span>
                      <span className={styles.modelPickerId}>
                        {draft.model || definition.modelInputPlaceholder || ""}
                      </span>
                    </div>
                    <div className={styles.modelPickerTriggerBadges}>
                      {selectedModelAccessBadge ? (
                        <span className={`${styles.badgeModelAccess} ${getAccessBadgeClassName(selectedModelAccessType)}`}>
                          {selectedModelAccessBadge}
                        </span>
                      ) : null}
                      <ChevronsUpDown size={14} />
                    </div>
                  </button>
                </PopoverTrigger>
                <PopoverContent className={styles.modelPickerPopover} align="start">
                  <div className={styles.modelPickerList} id={modelInputListId} role="listbox" aria-label={`${provider.name} ${stageLabelText} models`}>
                    {stageModels.map((model) => {
                      const isSelected = model.apiModel === draft.model;
                      return (
                        <button
                          key={model.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          className={`${styles.modelPickerItem} ${isSelected ? styles.modelPickerItemSelected : ""}`}
                          onClick={() => {
                            onChange({ model: model.apiModel });
                            setModelPickerOpen(false);
                          }}
                        >
                          <div className={styles.modelPickerItemMain}>
                            <div className={styles.modelPickerItemHeader}>
                              <span className={styles.modelPickerItemLabel}>{model.label}</span>
                              {model.accessBadgeLabel ? (
                                <span className={`${styles.badgeModelAccess} ${getAccessBadgeClassName(model.accessType)}`}>
                                  {model.accessBadgeLabel}
                                </span>
                              ) : null}
                            </div>
                            <div className={styles.modelPickerItemId}>{model.apiModel}</div>
                            {model.rateLimitSummary ? (
                              <div className={styles.modelPickerItemMeta}>{model.rateLimitSummary}</div>
                            ) : model.notes ? (
                              <div className={styles.modelPickerItemMeta}>{model.notes}</div>
                            ) : null}
                          </div>
                          {isSelected ? <Check size={14} className={styles.modelPickerItemCheck} /> : null}
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
              {useCustomModelInput ? (
                <input
                  type="text"
                  value={draft.model}
                  onChange={(event) => onChange({ model: event.target.value })}
                  className={styles.input}
                  placeholder={definition.modelInputPlaceholder ?? draft.model}
                />
              ) : null}
            </div>

            {/* API Base */}
            <div className={styles.field}>
              <label>{t("freeProviderCard.field.apiBase")}</label>
              <input
                type="text"
                value={draft.apiBase}
                className={styles.input}
                placeholder={definition.defaultApiBase}
                readOnly
                title={t("freeProviderCard.field.apiBaseTitle")}
              />
            </div>

            {/* API Key */}
            <div className={styles.field}>
              <label>{t("freeProviderCard.label.apiKey")} {requiresKey ? t("freeProviderCard.label.required") : t("freeProviderCard.label.optional")}</label>
              <input
                type="password"
                value={draft.apiKey}
                onChange={(event) => onChange({ apiKey: event.target.value })}
                className={styles.input}
                placeholder={t("freeProviderCard.placeholder.apiKey")}
              />
            </div>

            {/* Extra config fields */}
            {(definition.configFields ?? []).map((field) => (
              <div className={styles.field} key={`${provider.id}-${stage}-${field.id}`}>
                <label>
                  {field.label}
                  {field.required ? ` ${t("freeProviderCard.field.required")}` : ` ${t("freeProviderCard.field.optional")}`}
                </label>
                <input
                  type="text"
                  value={draft.params?.[field.id] ?? ""}
                  onChange={(event) =>
                    onChange({
                      params: {
                        ...draft.params,
                        [field.id]: event.target.value,
                      },
                    })
                  }
                  className={styles.input}
                  placeholder={field.placeholder ?? field.id}
                />
                {field.description ? <p className={styles.fieldHelp}>{field.description}</p> : null}
              </div>
            ))}
          </div>

          {!isIntegrated && (
            <p className={styles.statusWarn}>
              <AlertCircle size={12} /> {t("freeProviderCard.status.catalogOnly")}
            </p>
          )}

          {testResult ? (
            <p className={testResult.ok ? styles.statusOk : styles.statusWarn} role={testResult.ok ? 'status' : 'alert'}>
              {testResult.ok ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />} {testResult.message}
            </p>
          ) : null}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => void handleTest()}
              disabled={!isIntegrated || missingRequiredInput || testRunning}
            >
              {testRunning ? 'Testing...' : 'Test API'}
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={onSave}
              disabled={!isIntegrated || missingRequiredInput}
            >
              {t("freeProviderCard.actions.save")}
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={onUse}
              disabled={!isIntegrated || missingRequiredInput}
            >
              {t("freeProviderCard.actions.use")}
            </button>
          </div>
        </div>
      )}
    </article>
  );
};

export default FreeProviderCard;
