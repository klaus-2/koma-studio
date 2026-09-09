import {
  AlertTriangle,
  CheckCircle2,
  Download,
  RefreshCcw,
  Trash2,
  XCircle,
  Zap,
  Star,
} from 'lucide-react';
import { useI18n } from '../../i18n';

import type { ModelInstallState } from '../../models/types';
import { modelStageLabel } from '../../models/translation-models-registry';
import { ModelInfoTooltip } from './ModelInfoTooltip';
import { ModelProgressBar } from './ModelProgressBar';
import styles from './styles.module.css';

interface ModelCardProps {
  entry: ModelInstallState;
  focused?: boolean;
  selected?: boolean;
  selectable?: boolean;
  onInstall: (modelId: string) => Promise<void>;
  onUpdate: (modelId: string) => Promise<void>;
  onUninstall: (modelId: string) => Promise<void>;
  onRetry: (modelId: string) => Promise<void>;
  onCancel: (modelId: string) => Promise<void>;
  onSelect?: (modelId: string) => void;
}

const SPEED_CONFIG: Record<string, { label: string; class: string }> = {
  fast: { label: 'fast', class: 'speedBadgeFast' },
  ok: { label: 'ok', class: 'speedBadgeOk' },
  good: { label: 'good', class: 'speedBadgeGood' },
  excellent: { label: 'excellent', class: 'speedBadgeExcellent' },
};
const DEFAULT_SPEED_CONFIG = { label: 'ok', class: 'speedBadgeOk' };

export const ModelCard = ({
  entry,
  focused = false,
  selected = false,
  selectable = true,
  onInstall,
  onUpdate,
  onUninstall,
  onRetry,
  onCancel,
  onSelect,
}: ModelCardProps) => {
  const { t } = useI18n();
  const { model } = entry;
  const speedCfg = SPEED_CONFIG[model.speed] ?? DEFAULT_SPEED_CONFIG;

  const isActive =
    entry.status === 'downloading' ||
    entry.status === 'queued' ||
    entry.status === 'verifying';

  const statusBadge = (() => {
    if (
      selected &&
      (entry.status === 'installed' || entry.status === 'update_available')
    ) {
      return (
        <span className={styles.statusInstalled}>
          <CheckCircle2 size={11} /> {t('modelCard.status.selected')}
        </span>
      );
    }
    if (entry.status === 'installed') {
      return (
        <span className={styles.statusInstalled}>
          v{entry.installedVersion ?? model.version}
        </span>
      );
    }
    if (entry.status === 'update_available') {
      return (
        <span className={styles.statusUpdate}>
          <AlertTriangle size={11} /> v{model.version}
        </span>
      );
    }
    if (entry.status === 'failed') {
      return (
        <span className={styles.statusFailed}>
          <XCircle size={11} /> {t('modelCard.status.failed')}
        </span>
      );
    }
    if (entry.status === 'verifying')
      return <span className={styles.statusPending}>{t('modelCard.status.verifying')}</span>;
    if (entry.status === 'queued')
      return <span className={styles.statusPending}>{t('modelCard.status.queued')}</span>;
    if (entry.status === 'downloading')
      return <span className={styles.statusPending}>{t('modelCard.status.downloading')}</span>;
    if (entry.status === 'cancelled')
      return <span className={styles.statusNeutral}>{t('modelCard.status.cancelled')}</span>;
    if (entry.status === 'incomplete')
      return <span className={styles.statusFailed}>{t('modelCard.status.incomplete')}</span>;
    return <span className={styles.statusNeutral}>{t('modelCard.status.notInstalled')}</span>;
  })();

  const actionButton = (() => {
    if (isActive) {
      return (
        <button
          type="button"
          className={styles.warningButton}
          onClick={() => void onCancel(model.id)}
        >
          {t('modelCard.action.cancel')}
        </button>
      );
    }
    if (entry.status === 'installed') {
      return (
        <button
          type="button"
          className={styles.ghostButton}
          onClick={() => void onUninstall(model.id)}
        >
          <Trash2 size={12} /> {t('modelCard.action.remove')}
        </button>
      );
    }
    if (entry.status === 'update_available') {
      return (
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => void onUpdate(model.id)}
        >
          <RefreshCcw size={12} /> {t('modelCard.action.update')}
        </button>
      );
    }
    if (entry.status === 'incomplete') {
      return (
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => void onInstall(model.id)}
        >
          <Download size={12} /> {t('modelCard.action.install')}
        </button>
      );
    }
    if (entry.status === 'failed' || entry.status === 'cancelled') {
      return (
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => void onRetry(model.id)}
        >
          <RefreshCcw size={12} /> {t('modelCard.action.retry')}
        </button>
      );
    }
    return (
      <button
        type="button"
        className={styles.primaryButton}
        onClick={() => void onInstall(model.id)}
      >
        <Download size={12} /> {t('modelCard.action.install')}
      </button>
    );
  })();

  const canSelect =
    selectable &&
    (entry.status === 'installed' || entry.status === 'update_available');

  const speedLabel = speedCfg.label === 'fast' ? t('modelManager.tooltip.speed.fast') :
                     speedCfg.label === 'excellent' ? t('modelManager.tooltip.speed.excellent') :
                     speedCfg.label === 'good' ? t('modelManager.tooltip.speed.good') : t('modelManager.tooltip.speed.ok');

  return (
    <article
      className={[styles.modelCard, focused ? styles.modelCardFocused : '']
        .filter(Boolean)
        .join(' ')}
    >
      <header className={styles.modelCardHeader}>
        <div>
          <h4 className={styles.modelCardTitle}>
            <span className={styles.modelCardEmoji} aria-hidden="true">
              📦
            </span>
            {model.name}
            {model.recommended && (
              <span className={styles.recommendedBadge}>
                <Star size={7} /> {t('modelCard.recommended')}
              </span>
            )}
          </h4>
          <p className={styles.modelCardMeta}>
            {modelStageLabel(model.stage)}
            <span className={styles.metaDot} aria-hidden="true" />
            {model.requirements.gpu ? t('modelCard.hardware.gpu') : t('modelCard.hardware.cpu')}
            <span className={styles.metaDot} aria-hidden="true" />
            {model.fileSize}
            <span className={styles.metaDot} aria-hidden="true" />
            <span
              className={[styles.speedBadge, styles[speedCfg.class] ?? ''].join(' ')}
            >
              <Zap size={8} /> {speedLabel}
            </span>
          </p>
        </div>
      </header>

      <p className={styles.modelCardDescription}>{t(model.description as any)}</p>

      {entry.progress && isActive && (
        <ModelProgressBar
          progress={entry.progress}
          onCancel={() => void onCancel(model.id)}
        />
      )}

      <div className={styles.modelCardFooter}>
        <div className={styles.statusSlot}>{statusBadge}</div>
        <div className={styles.actionsSlot}>
          {canSelect && (
            <button
              type="button"
              className={styles.ghostButton}
              onClick={() => onSelect?.(model.id)}
              disabled={selected}
            >
              {selected ? (
                <>
                  <CheckCircle2 size={11} /> {t('modelCard.action.active')}
                </>
              ) : (
                t('modelCard.action.use')
              )}
            </button>
          )}
          {actionButton}
          <ModelInfoTooltip model={model} />
        </div>
      </div>

      {entry.error && (
        <p className={styles.errorText}>
          {entry.errorCode
            ? // Friendly message by taxonomy; translateMessage returns the
              // same key if it does not exist.
              t(`modelManager.downloadError.${entry.errorCode}`)
            : t(entry.error as any)}
        </p>
      )}
    </article>
  );
};

export default ModelCard;
