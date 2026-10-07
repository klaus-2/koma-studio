'use client';

import type { ChangeEvent } from 'react';
import { Plus } from 'lucide-react';

import { useI18n } from '../../../i18n';
import type {
  FeedApplication, FeedBan, FeedBanScope, FeedPost, FeedProfile, FeedReport,
} from '../../../services/scanlationFeed';
import type { FeedTab, ModerationBanScopeOption } from '../ScanlationFeed.types';
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
  onModerationPost: (post: FeedPost, status: FeedPost['moderationStatus']) => void;
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

export default function ScanlationFeedContent(props: ScanlationFeedContentProps) {
  const { t } = useI18n();
  const { tab, composerTypeLabel, onOpenComposer } = props;

  return (
    <>
      <div className="pointer-events-none fixed inset-0" aria-hidden="true">
        <div className="halftone absolute inset-0 opacity-60" />
        <div className="halftone-red absolute right-0 top-0 h-72 w-72 opacity-30" />
        <span className="text-outline absolute left-[6%] top-[18%] -rotate-12 select-none font-display text-8xl font-black opacity-60">
          쾅
        </span>
        <span className="text-outline absolute right-[10%] top-[42%] rotate-6 select-none font-display text-7xl font-black opacity-40">
          휙
        </span>
        <span className="text-outline absolute bottom-[14%] left-[16%] rotate-3 select-none font-display text-6xl font-black opacity-50">
          번쩍
        </span>
      </div>

      <div className="relative mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6">
        <ScanlationFeedHeaderToolbar
          tab={tab}
          canModerate={props.canModerate}
          heroTitle={props.heroTitle}
          composerTypeLabel={composerTypeLabel}
          feedback={props.feedback}
          error={props.error}
          onBackDashboard={props.onBackDashboard}
          onTabChange={props.onTabChange}
          onOpenComposer={onOpenComposer}
        />

        <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <ScanlationFeedPostsPanel
            tab={tab}
            canModerate={props.canModerate}
            loading={props.loading}
            currentUserId={props.currentUserId}
            visiblePosts={props.visiblePosts}
            formattedVisiblePostDates={props.formattedVisiblePostDates}
            composerTypeLabel={composerTypeLabel}
            onOpenComposer={onOpenComposer}
            onApplyPost={props.onApplyPost}
            onReportPost={props.onReportPost}
            onModerationPost={props.onModerationPost}
            onStartBanFromPost={props.onStartBanFromPost}
          />
          <ScanlationFeedSidebar
            tab={tab}
            canModerate={props.canModerate}
            profile={props.profile}
            rulesAccepted={props.rulesAccepted}
            profileWebhookEnabled={props.profileWebhookEnabled}
            profileWebhook={props.profileWebhook}
            sentApplications={props.sentApplications}
            receivedApplications={props.receivedApplications}
            reports={props.reports}
            bans={props.bans}
            banTargetUserId={props.banTargetUserId}
            banReason={props.banReason}
            banScope={props.banScope}
            moderationBanScopes={props.moderationBanScopes}
            onRulesAcceptedChange={props.onRulesAcceptedChange}
            onProfileWebhookEnabledChange={props.onProfileWebhookEnabledChange}
            onProfileWebhookChange={props.onProfileWebhookChange}
            onSaveProfile={props.onSaveProfile}
            setBanTargetUserId={props.setBanTargetUserId}
            setBanReason={props.setBanReason}
            setBanScope={props.setBanScope}
            onResolveReport={props.onResolveReport}
            onCreateBan={props.onCreateBan}
          />
        </section>

        {tab !== 'moderation' && (
          <button
            type="button"
            onClick={onOpenComposer}
            aria-label={t('feed.actions.createPost', { type: composerTypeLabel.toLowerCase() })}
            className="panel-cut-sm fixed bottom-6 right-6 z-40 grid h-14 w-14 place-items-center bg-crimson text-ink transition-all duration-150 hover:-translate-x-1 hover:-translate-y-1 hover:drop-shadow-[6px_6px_0_#ffc857]"
          >
            <Plus size={24} strokeWidth={2.5} />
          </button>
        )}
      </div>
    </>
  );
}
