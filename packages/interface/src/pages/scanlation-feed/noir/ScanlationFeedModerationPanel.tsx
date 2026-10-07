'use client';

import { Flag, Gavel, ShieldAlert } from 'lucide-react';

import { useI18n } from '../../../i18n';
import type { FeedBan, FeedBanScope, FeedReport } from '../../../services/scanlationFeed';
import type { ModerationBanScopeOption } from '../ScanlationFeed.types';
import {
  SideCard, SideEmpty, SideItem, FeedField, FeedInput, FeedTextarea, WeekdayPill, feedBtn,
} from './ScanlationFeedPrimitives';
import { formatFeedStateLabel } from './ScanlationFeedContent.utils';

type Props = {
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
  reports, bans, banTargetUserId, banReason, banScope,
  moderationBanScopes, setBanTargetUserId, setBanReason, setBanScope,
  onResolveReport, onCreateBan,
}: Props) {
  const { t } = useI18n();

  return (
    <>
      <SideCard icon={Flag} title={t('feed.sidebar.reportsTitle')}>
        {reports.length === 0 ? (
          <SideEmpty>{t('feed.sidebar.noReports')}</SideEmpty>
        ) : (
          <div className="flex flex-col gap-2">
            {reports.map((r) => (
              <SideItem
                key={r.id}
                title={r.postTitle}
                sub={formatFeedStateLabel(r.reasonCode)}
                actions={
                  <>
                    <button
                      type="button"
                      className={`${feedBtn.confirm} ${feedBtn.sm}`}
                      onClick={() => onResolveReport(r, 'resolved')}
                    >
                      {t('common.resolve')}
                    </button>
                    <button
                      type="button"
                      className={`${feedBtn.ghost} ${feedBtn.sm}`}
                      onClick={() => onResolveReport(r, 'dismissed')}
                    >
                      {t('common.dismiss')}
                    </button>
                  </>
                }
              />
            ))}
          </div>
        )}
      </SideCard>

      <SideCard icon={ShieldAlert} title={t('feed.sidebar.banTitle')}>
        <FeedField label={t('feed.moderation.targetUserId')}>
          <FeedInput
            value={banTargetUserId}
            onChange={(e) => setBanTargetUserId(e.target.value)}
          />
        </FeedField>
        <FeedField label={t('feed.report.reason')}>
          <FeedTextarea
            rows={3}
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
          />
        </FeedField>
        <div className="flex flex-wrap gap-1.5">
          {moderationBanScopes.map((scope) => (
            <WeekdayPill
              key={scope.key}
              active={banScope === scope.key}
              onClick={() => setBanScope(scope.key)}
            >
              {scope.label}
            </WeekdayPill>
          ))}
        </div>
        <button
          type="button"
          className={`${feedBtn.primary} ${feedBtn.full}`}
          onClick={onCreateBan}
        >
          <Gavel size={14} /> {t('feed.sidebar.applyBan')}
          <span aria-hidden className="font-accent text-[13px] normal-case italic tracking-normal opacity-70">
            追放
          </span>
        </button>
        {bans.length > 0 && (
          <div className="mt-2 flex flex-col gap-2">
            {bans.map((b) => (
              <SideItem
                key={b.banId}
                title={b.activeBan.reason}
                sub={formatFeedStateLabel(b.activeBan.scope)}
              />
            ))}
          </div>
        )}
      </SideCard>
    </>
  );
}
