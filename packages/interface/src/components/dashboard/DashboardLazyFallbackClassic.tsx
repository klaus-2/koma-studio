import type React from 'react';
import { Layers, Loader2 } from 'lucide-react';
import { useI18n } from '../../i18n';
import type { DashboardLazyFallbackProps } from './noir/DashboardLazyFallbackNoir';
import './DashboardLazyFallback.css';

export const DashboardLazyFallbackClassic: React.FC<
  DashboardLazyFallbackProps
> = ({ label }) => {
  const { t } = useI18n();
  const displayLabel = label?.trim() || t('dashboard.workspace.loadingTitle');

  return (
    <div
      className="koma-ws-loading"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={displayLabel}
    >
      <div className="koma-ws-loading__classic-card">
        <div className="koma-ws-loading__classic-head">
          <div className="koma-ws-loading__classic-brand">
            <div className="koma-ws-loading__classic-icon">
              <Layers size={17} aria-hidden="true" />
            </div>
            <div>
              <h3 className="koma-ws-loading__classic-title">{displayLabel}</h3>
              <p className="koma-ws-loading__classic-subtitle">
                {t('dashboard.workspace.loadingSubtitle')}
              </p>
            </div>
          </div>

          <span className="koma-ws-loading__classic-badge">
            <Loader2 size={12} className="animate-spin" aria-hidden="true" />
            {t('common.loading')}
          </span>
        </div>

        <div className="koma-ws-loading__classic-grid">
          {[0, 1, 2].map((index) => (
            <div key={index} className="koma-ws-loading__classic-tile">
              <div className="koma-ws-loading__classic-bar" />
              <div className="koma-ws-loading__classic-bar koma-ws-loading__classic-bar--short" />
              <div className="koma-ws-loading__classic-block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
