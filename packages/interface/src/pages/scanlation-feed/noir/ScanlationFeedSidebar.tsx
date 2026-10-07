'use client';

import type { ChangeEvent } from 'react';
import { Check, Inbox, User } from 'lucide-react';

import { useI18n } from '../../../i18n';
import type {
  FeedApplication, FeedBan, FeedBanScope, FeedProfile, FeedReport,
} from '../../../services/scanlationFeed';
import type {
  FeedTab, ModerationBanScopeOption,
} from '../ScanlationFeed.types';
import { SideCard, SideEmpty, SideItem, FeedField, FeedInput, feedBtn } from './ScanlationFeedPrimitives';
import { formatFeedStateLabel } from './ScanlationFeedContent.utils';
import ScanlationFeedModerationPanel from './ScanlationFeedModerationPanel';

type Props = {
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
  tab, canModerate, profile, rulesAccepted, profileWebhookEnabled, profileWebhook,
  sentApplications, receivedApplications, reports, bans,
  banTargetUserId, banReason, banScope, moderationBanScopes,
  onRulesAcceptedChange, onProfileWebhookEnabledChange, onProfileWebhookChange,
  onSaveProfile, setBanTargetUserId, setBanReason, setBanScope,
  onResolveReport, onCreateBan,
}: Props) {
  const { t } = useI18n();

  return (
    <aside className="flex flex-col gap-4">
      <SideCard icon={User} title={t('feed.sidebar.profileTitle')}>
        <label className="flex cursor-pointer items-start gap-2.5">
          <input type="checkbox" className="peer sr-only" checked={rulesAccepted} onChange={onRulesAcceptedChange} />
          <span aria-hidden className="mt-0.5 grid h-4 w-4 flex-none place-items-center border border-paper/30 peer-checked:border-crimson peer-checked:bg-crimson peer-checked:text-ink" style={{ clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 0 100%)' }}>
            <Check size={10} strokeWidth={3.5} className="opacity-0 peer-checked:opacity-100" />
          </span>
          <span className="text-[11px] leading-snug text-paper/65">{t('feed.sidebar.rulesLabel')}</span>
        </label>
        <label className="flex cursor-pointer items-start gap-2.5">
          <input type="checkbox" className="peer sr-only" checked={profileWebhookEnabled} onChange={onProfileWebhookEnabledChange} />
          <span aria-hidden className="mt-0.5 grid h-4 w-4 flex-none place-items-center border border-paper/30 peer-checked:border-crimson peer-checked:bg-crimson peer-checked:text-ink" style={{ clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 0 100%)' }}>
            <Check size={10} strokeWidth={3.5} className="opacity-0 peer-checked:opacity-100" />
          </span>
          <span className="text-[11px] leading-snug text-paper/65">{t('feed.sidebar.webhookLabel')}</span>
        </label>
        <FeedField label={t('settings.integrations.discordWebhook')}>
          <FeedInput
            placeholder={t('feed.sidebar.webhookPlaceholder')}
            value={profileWebhook}
            onChange={onProfileWebhookChange}
          />
        </FeedField>
        <button type="button" className={`${feedBtn.ghost} ${feedBtn.full}`} onClick={onSaveProfile}>
          {t('feed.sidebar.saveProfile')}
        </button>
        {profile && (
          <div className="flex flex-col gap-1 border-t border-paper/10 pt-2.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper/45">
            <span>
              {t('common.status')}: <strong className="text-mint">{formatFeedStateLabel(profile.status)}</strong>
            </span>
            <span>
              {t('feed.sidebar.webhookLabelShort')}:{' '}
              <strong className={profile.authorNotificationWebhookConfigured ? 'text-mint' : 'text-paper/40'}>
                {profile.authorNotificationWebhookConfigured ? t('common.configured') : t('common.no')}
              </strong>
            </span>
          </div>
        )}
      </SideCard>

      <SideCard icon={Inbox} title={t('feed.sidebar.inboxTitle')}>
        <div className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-paper/55">
          {t('feed.sidebar.yourApplications')}{' '}
          <span className="text-crimson">[{String(sentApplications.length).padStart(2, '0')}]</span>
        </div>
        {sentApplications.length === 0 ? (
          <SideEmpty>{t('feed.sidebar.noApplications')}</SideEmpty>
        ) : (
          <div className="flex flex-col gap-2">
            {sentApplications.map((a) => (
              <SideItem key={a.id} title={a.postTitle} sub={formatFeedStateLabel(a.status)} />
            ))}
          </div>
        )}
        <div className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.18em] text-paper/55">
          {t('feed.sidebar.receivedTitle')}{' '}
          <span className="text-crimson">[{String(receivedApplications.length).padStart(2, '0')}]</span>
        </div>
        {receivedApplications.length === 0 ? (
          <SideEmpty>{t('feed.sidebar.noReceived')}</SideEmpty>
        ) : (
          <div className="flex flex-col gap-2">
            {receivedApplications.map((a) => (
              <SideItem key={a.id} title={a.applicantName} sub={a.postTitle} />
            ))}
          </div>
        )}
      </SideCard>

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
