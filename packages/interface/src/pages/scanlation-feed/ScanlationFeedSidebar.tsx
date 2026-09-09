import type { ChangeEvent } from 'react';
import { Inbox, User } from 'lucide-react';

import { useI18n } from '../../i18n';
import type {
  FeedApplication,
  FeedBan,
  FeedBanScope,
  FeedProfile,
  FeedReport,
} from '../../services/scanlationFeed';
import type {
  FeedTab,
  ModerationBanScopeOption,
} from './ScanlationFeed.types';
import { formatFeedStateLabel } from './ScanlationFeedContent.utils';
import ScanlationFeedModerationPanel from './ScanlationFeedModerationPanel';

type ScanlationFeedSidebarProps = {
  tab: FeedTab;
  canModerate: boolean;
  profile: FeedProfile | null;
  rulesAccepted: boolean;
  profileWebhookEnabled: boolean;
  profileWebhook: string;
  sentApplications: FeedApplication[];
  receivedApplications: FeedApplication[];
  reports: FeedReport[];
  bans: FeedBan[];
  banTargetUserId: string;
  banReason: string;
  banScope: FeedBanScope;
  moderationBanScopes: readonly ModerationBanScopeOption[];
  onRulesAcceptedChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onProfileWebhookEnabledChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onProfileWebhookChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSaveProfile: () => void;
  setBanTargetUserId: (value: string) => void;
  setBanReason: (value: string) => void;
  setBanScope: (value: FeedBanScope) => void;
  onResolveReport: (report: FeedReport, status: FeedReport['status']) => void;
  onCreateBan: () => void;
};

export default function ScanlationFeedSidebar({
  tab,
  canModerate,
  profile,
  rulesAccepted,
  profileWebhookEnabled,
  profileWebhook,
  sentApplications,
  receivedApplications,
  reports,
  bans,
  banTargetUserId,
  banReason,
  banScope,
  moderationBanScopes,
  onRulesAcceptedChange,
  onProfileWebhookEnabledChange,
  onProfileWebhookChange,
  onSaveProfile,
  setBanTargetUserId,
  setBanReason,
  setBanScope,
  onResolveReport,
  onCreateBan,
}: ScanlationFeedSidebarProps) {
  const { t } = useI18n();

  return (
    <aside className="koma-feed__sidebar">
      <div className="koma-feed-sidebar-card">
        <div className="koma-feed-sidebar-card__title">
          <User size={14} /> {t('feed.sidebar.profileTitle')}
        </div>
        <div className="koma-feed-sidebar-card__body">
          <label className="koma-feed-check">
            <input
              type="checkbox"
              className="koma-feed-check__input"
              checked={rulesAccepted}
              onChange={onRulesAcceptedChange}
            />
            <span className="koma-feed-check__label">
              {t('feed.sidebar.rulesLabel')}
            </span>
          </label>
          <label className="koma-feed-check">
            <input
              type="checkbox"
              className="koma-feed-check__input"
              checked={profileWebhookEnabled}
              onChange={onProfileWebhookEnabledChange}
            />
            <span className="koma-feed-check__label">
              {t('feed.sidebar.webhookLabel')}
            </span>
          </label>
          <div className="koma-feed-field">
            <label className="koma-feed-field__label">
              {t('settings.integrations.discordWebhook')}
            </label>
            <input
              className="koma-feed-field__input"
              placeholder={t('feed.sidebar.webhookPlaceholder')}
              value={profileWebhook}
              onChange={onProfileWebhookChange}
            />
          </div>
          <button
            type="button"
            className="koma-feed-btn koma-feed-btn--ghost koma-feed-btn--full"
            onClick={onSaveProfile}
          >
            {t('feed.sidebar.saveProfile')}
          </button>
          {profile && (
            <div className="koma-feed-side-meta">
              <span>
                {t('common.status')}:{' '}
                <strong>{formatFeedStateLabel(profile.status)}</strong>
              </span>
              <span>
                {t('feed.sidebar.webhookLabelShort')}{' '}
                <strong>
                  {profile.authorNotificationWebhookConfigured
                    ? t('common.configured')
                    : t('common.no')}
                </strong>
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="koma-feed-sidebar-card">
        <div className="koma-feed-sidebar-card__title">
          <Inbox size={14} /> {t('feed.sidebar.inboxTitle')}
        </div>
        <div className="koma-feed-sidebar-card__body">
          <div className="koma-feed-side-heading">
            {t('feed.sidebar.yourApplications')}{' '}
            <span className="koma-feed-card__count">
              {sentApplications.length}
            </span>
          </div>
          {sentApplications.length === 0 ? (
            <p className="koma-feed-side-empty">
              {t('feed.sidebar.noApplications')}
            </p>
          ) : (
            <div className="koma-feed-side-list">
              {sentApplications.map((application) => (
                <div key={application.id} className="koma-feed-side-item">
                  <div className="koma-feed-side-item__title">
                    {application.postTitle}
                  </div>
                  <div className="koma-feed-side-item__sub">
                    {formatFeedStateLabel(application.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="koma-feed-side-heading" style={{ marginTop: 14 }}>
            {t('feed.sidebar.receivedTitle')}{' '}
            <span className="koma-feed-card__count">
              {receivedApplications.length}
            </span>
          </div>
          {receivedApplications.length === 0 ? (
            <p className="koma-feed-side-empty">{t('feed.sidebar.noReceived')}</p>
          ) : (
            <div className="koma-feed-side-list">
              {receivedApplications.map((application) => (
                <div key={application.id} className="koma-feed-side-item">
                  <div className="koma-feed-side-item__title">
                    {application.applicantName}
                  </div>
                  <div className="koma-feed-side-item__sub">
                    {application.postTitle}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {canModerate && tab === 'moderation' && (
        <ScanlationFeedModerationPanel
          reports={reports}
          bans={bans}
          banTargetUserId={banTargetUserId}
          banReason={banReason}
          banScope={banScope}
          moderationBanScopes={moderationBanScopes}
          setBanTargetUserId={setBanTargetUserId}
          setBanReason={setBanReason}
          setBanScope={setBanScope}
          onResolveReport={onResolveReport}
          onCreateBan={onCreateBan}
        />
      )}
    </aside>
  );
}
