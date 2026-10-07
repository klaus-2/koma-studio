'use client';

import { useMemo, useState } from 'react';
import {
  AlertCircle, Check, CheckCircle2, ChevronDown, ChevronsUpDown,
  ExternalLink, Info, Zap,
} from 'lucide-react';
import { useI18n } from '../../i18n';

import type {
  FreeAiProviderCatalogEntry,
  FreeProviderDraftValue,
  FreeProviderStage,
  FreeProviderStageDefinition,
} from '../../models/freeAiProviderCatalog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import ResourceExternalAnchor from '../resources/ResourceExternalAnchor';
import { NoirField, NoirInput } from '../noir/NoirPrimitives';
import { AccessBadge, ProviderStatus, providerCardClass } from '../noir/noir-provider';

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
  provider, stage, definition, draft, selectedProfileLabel,
  onChange, onSave, onUse, onTest,
}: FreeProviderCardProps) => {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);

  const stageLabelText =
    stage === 'translation' ? t('freeProviderCard.stage.translation')
      : stage === 'clean' ? t('freeProviderCard.stage.clean')
        : t('freeProviderCard.stage.ocr');
  const isIntegrated = provider.status === 'integrated';
  const requiresKey = definition.requiresUserApiKey;
  const modelInputListId = `free-provider-models-${provider.id}-${stage}`;
  const useCustomModelInput = Boolean(definition.allowCustomModelInput);
  const selectedModelDefinition = definition.models.find((mo) => mo.apiModel === draft.model) ?? null;
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
      const rawValue = String(draft.params?.[field.id] ?? '').trim();
      if (!rawValue) return `${field.label}: ${t('freeProviderCard.empty')}`;
      return `${field.label}: ${rawValue}`;
    })
    .join(' | ');
  const missingRequiredParams = (definition.configFields ?? []).some(
    (field) => field.required && !String(draft.params?.[field.id] ?? '').trim(),
  );
  const missingRequiredInput =
    !draft.model.trim()
    || !draft.apiBase.trim()
    || missingRequiredParams
    || (requiresKey && !draft.apiKey.trim());

  const handleTest = async (): Promise<void> => {
    setTestRunning(true);
    setTestResult(null);
    try {
      setTestResult(await onTest());
    } catch (error) {
      setTestResult({
        ok: false,
        message: error instanceof Error ? error.message : 'Failed to test provider configuration.',
      });
    } finally {
      setTestRunning(false);
    }
  };

  const tipLine = (label: string, value: string) => (
    <p className="text-[10px] leading-relaxed text-paper/60">
      <strong className="font-mono text-[9px] uppercase tracking-[0.12em] text-crimson">{label}</strong>{' '}
      {value}
    </p>
  );

  return (
    <article className={providerCardClass(expanded)}>
      {/* ── Header ── */}
      <header
        className="flex cursor-pointer items-center gap-3 px-3.5 py-3"
        onClick={() => setExpanded((p) => !p)}
      >
        <span className="panel-cut-sm grid h-8 w-8 flex-none place-items-center border border-gold/40 bg-gold/10 text-gold">
          <Zap size={13} />
        </span>

        <div className="min-w-0 flex-1">
          <h4 className="truncate font-display text-[12.5px] font-extrabold uppercase tracking-wide text-paper">
            {provider.name}
          </h4>
          <p className="truncate font-mono text-[9px] uppercase tracking-[0.14em] text-paper/40">
            {stageLabelText} · {selectedModelLabel || t('freeProviderCard.info.notSelected')}
          </p>
        </div>

        <div className="flex flex-none items-center gap-1.5">
          <span
            className={`panel-cut-sm border px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.16em] ${isIntegrated
                ? 'border-mint/50 bg-mint/10 text-mint'
                : 'border-paper/25 text-paper/50'
              }`}
          >
            {isIntegrated ? t('freeProviderCard.badge.integrated') : t('freeProviderCard.badge.catalog')}
          </span>

          {shouldShowProviderAccessBadge && (
            <AccessBadge accessType={provider.accessType}>{provider.accessBadgeLabel}</AccessBadge>
          )}
          {selectedModelAccessBadge && (
            <AccessBadge accessType={selectedModelAccessType}>{selectedModelAccessBadge}</AccessBadge>
          )}
          {selectedProfileLabel && (
            <span className="panel-cut-sm inline-flex items-center gap-1 border border-crimson/50 bg-crimson/10 px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-crimson">
              <CheckCircle2 size={9} /> {selectedProfileLabel}
            </span>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="noir-icon-btn"
                  aria-label={t('freeProviderCard.info.tooltip', { name: provider.name })}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Info size={11} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="flex max-w-sm flex-col gap-1 !p-3">
                <div className="font-display text-[11px] font-black uppercase tracking-wide text-paper">
                  {provider.name}
                </div>
                {tipLine(t('freeProviderCard.info.selectedModel'), selectedModelLabel || t('freeProviderCard.info.notSelected'))}
                {tipLine(t('freeProviderCard.info.modelId'), draft.model || t('freeProviderCard.info.notDefined'))}
                {tipLine(t('freeProviderCard.info.apiBase'), draft.apiBase || definition.defaultApiBase)}
                {tipLine(
                  t('freeProviderCard.info.apiKey'),
                  draft.apiKey.trim()
                    ? t('freeProviderCard.info.configured')
                    : requiresKey ? t('freeProviderCard.info.required') : t('freeProviderCard.info.optional'),
                )}
                {configSummary ? tipLine(t('freeProviderCard.info.extraFields'), configSummary) : null}
                {provider.accessSummary ? tipLine(t('freeProviderCard.info.access'), provider.accessSummary) : null}
                {selectedModelAccessBadge ? tipLine(t('freeProviderCard.info.modelAccess'), selectedModelAccessBadge) : null}
                {selectedModelRateLimit ? tipLine(t('freeProviderCard.info.modelLimits'), selectedModelRateLimit) : null}
                {provider.verificationNotice ? tipLine(t('freeProviderCard.info.verification'), provider.verificationNotice) : null}
                {provider.dataPolicyNotice ? tipLine(t('freeProviderCard.info.dataPolicy'), provider.dataPolicyNotice) : null}
                {tipLine(t('freeProviderCard.info.setup'), provider.setupSummary)}
                {tipLine(t('freeProviderCard.info.limits'), provider.limitsSummary)}
                {tipLine(t('freeProviderCard.info.rateLimits'), provider.rateLimitSummary)}
                {tipLine(t('freeProviderCard.info.modelsInStage'), String(definition.models.length))}
                <div className="mt-1.5 flex flex-wrap gap-2 border-t border-paper/10 pt-2">
                  {[
                    { href: provider.setupUrl, label: t('freeProviderCard.setup') },
                    { href: provider.limitsUrl, label: t('freeProviderCard.limits') },
                    { href: provider.rateLimitsUrl, label: t('freeProviderCard.rateLimits') },
                  ].map((link) => (
                    <ResourceExternalAnchor
                      key={link.label}
                      href={link.href}
                      className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.12em] text-azure hover:text-paper"
                    >
                      {link.label} <ExternalLink size={9} />
                    </ResourceExternalAnchor>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

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
          {(provider.accessSummary || selectedModelAccessBadge || selectedModelRateLimit) && (
            <div className="halftone panel-cut-sm flex flex-wrap items-start gap-2 border border-paper/8 bg-ink/50 p-3">
              {shouldShowProviderAccessBadge && (
                <AccessBadge accessType={provider.accessType}>{provider.accessBadgeLabel}</AccessBadge>
              )}
              {selectedModelAccessBadge && (
                <AccessBadge accessType={selectedModelAccessType}>{selectedModelAccessBadge}</AccessBadge>
              )}
              <div className="min-w-0 flex-1 text-[10px] leading-relaxed text-paper/50">
                {provider.accessSummary && <p>{provider.accessSummary}</p>}
                {selectedModelRateLimit && <p>{selectedModelRateLimit}</p>}
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {/* Model picker */}
            <NoirField as="div" className="sm:col-span-2" label={t('freeProviderCard.field.model')}>
              <Popover open={modelPickerOpen} onOpenChange={setModelPickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-expanded={modelPickerOpen}
                    aria-controls={modelInputListId}
                    className="panel-cut-sm flex w-full items-center justify-between gap-3 border border-paper/15 bg-ink/70 px-3 py-2.5 text-left transition-colors hover:border-crimson/50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-display text-[11.5px] font-bold text-paper">
                        {selectedModelLabel || t('freeProviderCard.info.notSelected')}
                      </span>
                      <span className="block truncate font-mono text-[9px] text-paper/40">
                        {draft.model || definition.modelInputPlaceholder || ''}
                      </span>
                    </span>
                    <span className="flex flex-none items-center gap-1.5">
                      {selectedModelAccessBadge && (
                        <AccessBadge accessType={selectedModelAccessType}>{selectedModelAccessBadge}</AccessBadge>
                      )}
                      <ChevronsUpDown size={13} className="text-crimson" />
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[340px] p-1.5" align="start">
                  <div
                    id={modelInputListId}
                    role="listbox"
                    aria-label={`${provider.name} ${stageLabelText} models`}
                    className="noir-scroll flex max-h-72 flex-col gap-0.5 overflow-y-auto"
                  >
                    {stageModels.map((model) => {
                      const isSelected = model.apiModel === draft.model;
                      return (
                        <button
                          key={model.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            onChange({ model: model.apiModel });
                            setModelPickerOpen(false);
                          }}
                          className={`flex items-start gap-2 border-l-2 px-2.5 py-2 text-left transition-colors ${isSelected
                              ? 'border-l-crimson bg-crimson/10'
                              : 'border-l-transparent hover:bg-paper/5'
                            }`}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate font-display text-[11px] font-bold text-paper">
                                {model.label}
                              </span>
                              {model.accessBadgeLabel && (
                                <AccessBadge accessType={model.accessType}>{model.accessBadgeLabel}</AccessBadge>
                              )}
                            </span>
                            <span className="block truncate font-mono text-[9px] text-paper/40">
                              {model.apiModel}
                            </span>
                            {(model.rateLimitSummary || model.notes) && (
                              <span className="block truncate text-[9px] text-paper/35">
                                {model.rateLimitSummary ?? model.notes}
                              </span>
                            )}
                          </span>
                          {isSelected && <Check size={13} className="mt-0.5 flex-none text-crimson" />}
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
              {useCustomModelInput && (
                <NoirInput
                  type="text"
                  value={draft.model}
                  onChange={(e) => onChange({ model: e.target.value })}
                  placeholder={definition.modelInputPlaceholder ?? draft.model}
                />
              )}
            </NoirField>

            <NoirField label={t('freeProviderCard.field.apiBase')}>
              <NoirInput
                type="text"
                value={draft.apiBase}
                placeholder={definition.defaultApiBase}
                readOnly
                title={t('freeProviderCard.field.apiBaseTitle')}
              />
            </NoirField>

            <NoirField
              label={`${t('freeProviderCard.label.apiKey')} ${requiresKey ? t('freeProviderCard.label.required') : t('freeProviderCard.label.optional')}`}
            >
              <NoirInput
                type="password"
                value={draft.apiKey}
                onChange={(e) => onChange({ apiKey: e.target.value })}
                placeholder={t('freeProviderCard.placeholder.apiKey')}
              />
            </NoirField>

            {(definition.configFields ?? []).map((field) => (
              <NoirField
                key={`${provider.id}-${stage}-${field.id}`}
                label={`${field.label} ${field.required ? t('freeProviderCard.field.required') : t('freeProviderCard.field.optional')}`}
              >
                <NoirInput
                  type="text"
                  value={draft.params?.[field.id] ?? ''}
                  onChange={(e) =>
                    onChange({ params: { ...draft.params, [field.id]: e.target.value } })
                  }
                  placeholder={field.placeholder ?? field.id}
                />
                {field.description && (
                  <p className="mt-1 text-[9.5px] leading-snug text-paper/35">{field.description}</p>
                )}
              </NoirField>
            ))}
          </div>

          {!isIntegrated && (
            <ProviderStatus ok={false}>
              <AlertCircle size={12} className="mt-0.5 flex-none" /> {t('freeProviderCard.status.catalogOnly')}
            </ProviderStatus>
          )}
          {testResult && (
            <ProviderStatus ok={testResult.ok}>
              {testResult.ok ? <CheckCircle2 size={12} className="mt-0.5 flex-none" /> : <AlertCircle size={12} className="mt-0.5 flex-none" />}{' '}
              {testResult.message}
            </ProviderStatus>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t border-paper/8 pt-3">
            <button
              type="button" className="btn-ghost"
              onClick={() => void handleTest()}
              disabled={!isIntegrated || missingRequiredInput || testRunning}
            >
              {testRunning ? t('freeProviderCard.actions.testing') : t('freeProviderCard.actions.testApi')}
            </button>
            <button
              type="button" className="btn-ghost"
              onClick={onSave}
              disabled={!isIntegrated || missingRequiredInput}
            >
              {t('freeProviderCard.actions.save')}
            </button>
            <button
              type="button" className="btn-primary !py-2 !text-[11px]"
              onClick={onUse}
              disabled={!isIntegrated || missingRequiredInput}
            >
              {t('freeProviderCard.actions.use')}
            </button>
          </div>
        </div>
      )}
    </article>
  );
};

export default FreeProviderCard;
