import { Flag, Gavel, ShieldAlert } from 'lucide-react';

import { useI18n } from '../../i18n';
import type { FeedBan, FeedBanScope, FeedReport } from '../../services/scanlationFeed';
import type { ModerationBanScopeOption } from './ScanlationFeed.types';
import { formatFeedStateLabel } from './ScanlationFeedContent.utils';

type ScanlationFeedModerationPanelProps = {
  reports: FeedReport[];
  bans: FeedBan[];
  banTargetUserId: string;
  banReason: string;
  banScope: FeedBanScope;
  moderationBanScopes: readonly ModerationBanScopeOption[];
  setBanTargetUserId: (value: string) => void;
  setBanReason: (value: string) => void;
  setBanScope: (value: FeedBanScope) => void;
  onResolveReport: (report: FeedReport, status: FeedReport['status']) => void;
  onCreateBan: () => void;
};

export default function ScanlationFeedModerationPanel({
  reports,
  bans,
  banTargetUserId,
  banReason,
  banScope,
  moderationBanScopes,
  setBanTargetUserId,
  setBanReason,
  setBanScope,
  onResolveReport,
  onCreateBan,
}: ScanlationFeedModerationPanelProps) {
  const { t } = useI18n();

  return (
    <>
      <div className="koma-feed-sidebar-card">
        <div className="koma-feed-sidebar-card__title">
          <Flag size={14} /> {t('feed.sidebar.reportsTitle')}
        </div>
        <div className="koma-feed-sidebar-card__body">
          {reports.length === 0 ? (
            <p className="koma-feed-side-empty">{t('feed.sidebar.noReports')}</p>
          ) : (
            <div className="koma-feed-side-list">
              {reports.map((report) => (
                <div key={report.id} className="koma-feed-side-item">
                  <div className="koma-feed-side-item__title">
                    {report.postTitle}
                  </div>
                  <div className="koma-feed-side-item__sub">
                    {formatFeedStateLabel(report.reasonCode)}
                  </div>
                  <div className="koma-feed-side-item__actions">
                    <button
                      type="button"
                      className="koma-feed-btn koma-feed-btn--confirm koma-feed-btn--sm"
                      onClick={() => onResolveReport(report, 'resolved')}
                    >
                      {t('common.resolve')}
                    </button>
                    <button
                      type="button"
                      className="koma-feed-btn koma-feed-btn--ghost koma-feed-btn--sm"
                      onClick={() => onResolveReport(report, 'dismissed')}
                    >
                      {t('common.dismiss')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="koma-feed-sidebar-card">
        <div className="koma-feed-sidebar-card__title">
          <ShieldAlert size={14} /> {t('feed.sidebar.banTitle')}
        </div>
        <div className="koma-feed-sidebar-card__body">
          <div className="koma-feed-field">
            <label className="koma-feed-field__label">
              {t('feed.moderation.targetUserId')}
            </label>
            <input
              className="koma-feed-field__input"
              value={banTargetUserId}
              onChange={(e) => setBanTargetUserId(e.target.value)}
            />
          </div>
          <div className="koma-feed-field">
            <label className="koma-feed-field__label">
              {t('feed.report.reason')}
            </label>
            <textarea
              className="koma-feed-field__textarea"
              rows={3}
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
            />
          </div>
          <div className="koma-feed-pill-group">
            {moderationBanScopes.map((scope) => (
              <button
                key={scope.key}
                type="button"
                className={`koma-feed-pill${banScope === scope.key ? ' koma-feed-pill--active' : ''}`}
                onClick={() => setBanScope(scope.key)}
              >
                {scope.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="koma-feed-btn koma-feed-btn--primary koma-feed-btn--full"
            onClick={onCreateBan}
          >
            <Gavel size={14} /> {t('feed.sidebar.applyBan')}
          </button>
          {bans.length > 0 && (
            <div className="koma-feed-side-list" style={{ marginTop: 10 }}>
              {bans.map((ban) => (
                <div key={ban.banId} className="koma-feed-side-item">
                  <div className="koma-feed-side-item__title">
                    {ban.activeBan.reason}
                  </div>
                  <div className="koma-feed-side-item__sub">
                    {formatFeedStateLabel(ban.activeBan.scope)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
