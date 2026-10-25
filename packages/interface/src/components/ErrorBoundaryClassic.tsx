import {
  AlertTriangle,
  Check,
  ChevronRight,
  Copy,
  RefreshCcw,
  RotateCcw,
} from 'lucide-react';

import { useI18n } from '../i18n';
import type { ErrorFallbackProps } from './ErrorBoundary.types';

export const ErrorBoundaryClassic = ({
  errorName,
  errorText,
  detailsOpen,
  copied,
  onToggleDetails,
  onCopy,
  onRetry,
  onReload,
}: ErrorFallbackProps) => {
  const { t } = useI18n();

  return (
    <div role="alert" className="koma-error-boundary">
      <section className="koma-error-boundary__card">
        <span className="koma-error-boundary__rail" aria-hidden="true" />

        <header className="koma-error-boundary__head">
          <span className="koma-error-boundary__icon" aria-hidden="true">
            <AlertTriangle size={19} strokeWidth={2.2} />
          </span>
          <div className="koma-error-boundary__heading">
            <span className="koma-error-boundary__tag">{errorName}</span>
            <h2 className="koma-error-boundary__title">{t('errorBoundary.title')}</h2>
            <p className="koma-error-boundary__desc">{t('errorBoundary.description')}</p>
          </div>
        </header>

        <div className="koma-error-boundary__toggle-row">
          <button
            type="button"
            className="koma-error-boundary__toggle"
            aria-expanded={detailsOpen}
            onClick={onToggleDetails}
          >
            <ChevronRight
              className="koma-error-boundary__chevron"
              size={13}
              aria-hidden="true"
            />
            {t(detailsOpen ? 'errorBoundary.hideDetails' : 'errorBoundary.details')}
          </button>
          <span className="koma-error-boundary__rule" aria-hidden="true" />
        </div>

        {detailsOpen && (
          <div className="koma-error-boundary__report">
            <pre className="koma-error-boundary__trace">{errorText}</pre>
            <button
              type="button"
              className="koma-error-boundary__copy"
              onClick={onCopy}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {t(copied ? 'errorBoundary.copied' : 'errorBoundary.copy')}
            </button>
          </div>
        )}

        <footer className="koma-error-boundary__actions">
          <button type="button" className="koma-btn koma-btn--primary" onClick={onRetry}>
            <RotateCcw size={13} aria-hidden="true" />
            {t('errorBoundary.retry')}
          </button>
          <button type="button" className="koma-btn koma-btn--ghost" onClick={onReload}>
            <RefreshCcw size={13} aria-hidden="true" />
            {t('errorBoundary.reload')}
          </button>
        </footer>
      </section>
    </div>
  );
};
