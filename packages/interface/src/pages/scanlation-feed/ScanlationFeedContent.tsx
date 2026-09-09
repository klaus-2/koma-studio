import type { ChangeEvent } from 'react';
import { Plus } from 'lucide-react';

import { useI18n } from '../../i18n';
import type {
  FeedApplication,
  FeedBan,
  FeedBanScope,
  FeedPost,
  FeedProfile,
  FeedReport,
} from '../../services/scanlationFeed';
import type {
  FeedTab,
  ModerationBanScopeOption,
} from './ScanlationFeed.types';
import ScanlationFeedHeaderToolbar from './ScanlationFeedHeaderToolbar';
import ScanlationFeedPostsPanel from './ScanlationFeedPostsPanel';
import ScanlationFeedSidebar from './ScanlationFeedSidebar';

type ScanlationFeedContentProps = {
  tab: FeedTab;
  canModerate: boolean;
  heroTitle: string;
  composerTypeLabel: string;
  feedback: string | null;
  error: string | null;
  loading: boolean;
  currentUserId?: string;
  profile: FeedProfile | null;
  rulesAccepted: boolean;
  profileWebhookEnabled: boolean;
  profileWebhook: string;
  visiblePosts: FeedPost[];
  formattedVisiblePostDates: ReadonlyMap<string, string>;
  sentApplications: FeedApplication[];
  receivedApplications: FeedApplication[];
  reports: FeedReport[];
  bans: FeedBan[];
  banTargetUserId: string;
  banReason: string;
  banScope: FeedBanScope;
  moderationBanScopes: readonly ModerationBanScopeOption[];
  onBackDashboard: () => void;
  onTabChange: (tab: FeedTab) => void;
  onOpenComposer: () => void;
  onApplyPost: (post: FeedPost) => void;
  onReportPost: (post: FeedPost) => void;
  onModerationPost: (
    post: FeedPost,
    status: FeedPost['moderationStatus'],
  ) => void;
  onStartBanFromPost: (post: FeedPost) => void;
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

export default function ScanlationFeedContent({
  tab,
  canModerate,
  heroTitle,
  composerTypeLabel,
  feedback,
  error,
  loading,
  currentUserId,
  profile,
  rulesAccepted,
  profileWebhookEnabled,
  profileWebhook,
  visiblePosts,
  formattedVisiblePostDates,
  sentApplications,
  receivedApplications,
  reports,
  bans,
  banTargetUserId,
  banReason,
  banScope,
  moderationBanScopes,
  onBackDashboard,
  onTabChange,
  onOpenComposer,
  onApplyPost,
  onReportPost,
  onModerationPost,
  onStartBanFromPost,
  onRulesAcceptedChange,
  onProfileWebhookEnabledChange,
  onProfileWebhookChange,
  onSaveProfile,
  setBanTargetUserId,
  setBanReason,
  setBanScope,
  onResolveReport,
  onCreateBan,
}: ScanlationFeedContentProps) {
  const { t } = useI18n();

  return (
    <>
      <div className="koma-feed__bg" aria-hidden="true">
        <div className="koma-feed__orb koma-feed__orb--purple" />
        <div className="koma-feed__orb koma-feed__orb--cyan" />
        <div className="koma-feed__orb koma-feed__orb--rose" />
        <div className="koma-feed__halftone" />
        <span className="koma-feed__sfx koma-feed__sfx--1">쾅</span>
        <span className="koma-feed__sfx koma-feed__sfx--2">휙</span>
        <span className="koma-feed__sfx koma-feed__sfx--3">번쩍</span>
      </div>

      <div className="koma-feed__content">
        <ScanlationFeedHeaderToolbar
          tab={tab}
          canModerate={canModerate}
          heroTitle={heroTitle}
          composerTypeLabel={composerTypeLabel}
          feedback={feedback}
          error={error}
          onBackDashboard={onBackDashboard}
          onTabChange={onTabChange}
          onOpenComposer={onOpenComposer}
        />

        <section className="koma-feed__grid">
          <ScanlationFeedPostsPanel
            tab={tab}
            canModerate={canModerate}
            loading={loading}
            currentUserId={currentUserId}
            visiblePosts={visiblePosts}
            formattedVisiblePostDates={formattedVisiblePostDates}
            composerTypeLabel={composerTypeLabel}
            onOpenComposer={onOpenComposer}
            onApplyPost={onApplyPost}
            onReportPost={onReportPost}
            onModerationPost={onModerationPost}
            onStartBanFromPost={onStartBanFromPost}
          />

          <ScanlationFeedSidebar
            tab={tab}
            canModerate={canModerate}
            profile={profile}
            rulesAccepted={rulesAccepted}
            profileWebhookEnabled={profileWebhookEnabled}
            profileWebhook={profileWebhook}
            sentApplications={sentApplications}
            receivedApplications={receivedApplications}
            reports={reports}
            bans={bans}
            banTargetUserId={banTargetUserId}
            banReason={banReason}
            banScope={banScope}
            moderationBanScopes={moderationBanScopes}
            onRulesAcceptedChange={onRulesAcceptedChange}
            onProfileWebhookEnabledChange={onProfileWebhookEnabledChange}
            onProfileWebhookChange={onProfileWebhookChange}
            onSaveProfile={onSaveProfile}
            setBanTargetUserId={setBanTargetUserId}
            setBanReason={setBanReason}
            setBanScope={setBanScope}
            onResolveReport={onResolveReport}
            onCreateBan={onCreateBan}
          />
        </section>

        {tab !== 'moderation' && (
          <button
            type="button"
            className="koma-feed-fab"
            onClick={onOpenComposer}
            aria-label={t('feed.actions.createPost', {
              type: composerTypeLabel.toLowerCase(),
            })}
          >
            <Plus size={24} />
          </button>
        )}
      </div>
    </>
  );
}
