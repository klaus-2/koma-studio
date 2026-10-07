'use client';

import {
  AlertTriangle, Briefcase, Flag, Gavel, Megaphone, Plus, Send, Users,
} from 'lucide-react';

import { useI18n } from '../../../i18n';
import type { FeedPost } from '../../../services/scanlationFeed';
import type { FeedTab } from '../ScanlationFeed.types';
import { feedBtn } from './ScanlationFeedPrimitives';

type Props = {
  tab: FeedTab;
  canModerate: boolean;
  loading: boolean;
  currentUserId?: string;
  visiblePosts: FeedPost[];
  formattedVisiblePostDates: ReadonlyMap<string, string>;
  composerTypeLabel: string;
  onOpenComposer: () => void;
  onApplyPost: (post: FeedPost) => void;
  onReportPost: (post: FeedPost) => void;
  onModerationPost: (post: FeedPost, status: FeedPost['moderationStatus']) => void;
  onStartBanFromPost: (post: FeedPost) => void;
};

export default function ScanlationFeedPostsPanel({
  tab, canModerate, loading, currentUserId, visiblePosts,
  formattedVisiblePostDates, composerTypeLabel,
  onOpenComposer, onApplyPost, onReportPost, onModerationPost, onStartBanFromPost,
}: Props) {
  const { t } = useI18n();

  const HeadIcon = tab === 'recruitment' ? Users : tab === 'showcase' ? Megaphone : Gavel;
  const headTitle =
    tab === 'recruitment' ? t('feed.card.recruitmentRecent')
      : tab === 'showcase' ? t('feed.card.showcaseRecent')
        : t('feed.card.moderationQueue');

  return (
    <div className="glass panel-cut min-w-0 p-4">
      {/* Head */}
      <div className="mb-4 flex items-center gap-2.5 border-b border-paper/10 pb-3">
        <span className="panel-cut-sm grid h-7 w-7 flex-none place-items-center bg-crimson text-ink">
          <HeadIcon size={13} strokeWidth={2.5} />
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper/75">
          {headTitle}
        </span>
        <span className="ml-auto font-mono text-[10px] text-crimson">
          [{String(visiblePosts.length).padStart(2, '0')}]
        </span>
      </div>

      {loading ? (
        <div role="status" className="flex items-center justify-center gap-3 py-12 font-mono text-[10.5px] uppercase tracking-[0.2em] text-paper/45">
          <span className="noir-spinner" aria-hidden /> {t('feed.loading')}
        </div>
      ) : visiblePosts.length === 0 ? (
        <div className="relative flex flex-col items-center gap-3 border border-dashed border-paper/15 py-14">
          <span aria-hidden className="text-outline pointer-events-none absolute right-6 top-3 select-none font-display text-6xl font-black">
            無
          </span>
          <span className="panel-cut-sm grid h-11 w-11 place-items-center border border-crimson/40 bg-crimson/10 text-crimson">
            {tab === 'recruitment' ? <Users size={20} /> : <Megaphone size={20} />}
          </span>
          <p className="font-display text-[13px] font-black uppercase tracking-wide text-paper">
            {tab === 'recruitment' ? t('feed.empty.noRecruitment')
              : tab === 'showcase' ? t('feed.empty.noShowcase')
                : t('feed.empty.cleanQueue')}
          </p>
          <p className="max-w-xs text-center font-mono text-[9.5px] uppercase tracking-[0.14em] text-paper/40">
            {tab !== 'moderation'
              ? t('feed.empty.beFirst', { type: composerTypeLabel.toLowerCase() })
              : t('feed.empty.noModPosts')}
          </p>
          {tab !== 'moderation' && (
            <button type="button" className={feedBtn.primary} onClick={onOpenComposer}>
              <Plus size={14} /> {t('feed.actions.createPost', { type: composerTypeLabel.toLowerCase() })}
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {visiblePosts.map((post) => {
            const isRecruit = post.type === 'recruitment';
            return (
              <article
                key={post.id}
                className={`panel-cut-sm relative border bg-ink-2/60 transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:drop-shadow-[5px_5px_0_rgba(255,200,87,0.5)] ${isRecruit ? 'border-crimson/25' : 'border-azure/25'
                  }`}
              >
                <span
                  aria-hidden
                  className={`absolute inset-y-0 left-0 w-1 ${isRecruit ? 'bg-crimson' : 'bg-azure'}`}
                />

                <div className="flex flex-col gap-3 p-4 pl-5">
                  {/* Header */}
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className={`panel-cut-sm grid h-9 w-9 flex-none place-items-center font-display text-[15px] font-black ${isRecruit ? 'bg-crimson text-ink' : 'bg-azure text-ink'
                        }`}
                    >
                      {post.author.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-[12px] font-extrabold uppercase tracking-wide text-paper">
                        {post.author.name}
                      </div>
                      <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-paper/35">
                        {formattedVisiblePostDates.get(post.id)}
                      </div>
                    </div>
                    <span
                      className={`panel-cut-sm flex-none border px-2 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.18em] ${isRecruit
                        ? 'border-crimson/50 bg-crimson/10 text-crimson'
                        : 'border-azure/50 bg-azure/10 text-azure'
                        }`}
                    >
                      {isRecruit ? t('feed.post.recruitLabel') : t('feed.post.showcaseLabel')}
                    </span>
                  </div>

                  <h2 className="font-display text-[16px] font-black uppercase leading-tight tracking-tight text-paper">
                    {post.title}
                  </h2>
                  {post.summary && (
                    <p className="font-accent text-[13px] italic leading-relaxed text-paper/55">
                      {post.summary}
                    </p>
                  )}
                  <p className="text-[12px] leading-relaxed text-paper/65">{post.body}</p>

                  {/* Risk warning (mods) */}
                  {canModerate && post.riskReasons.length > 0 && (
                    <div
                      role="alert"
                      className="panel-cut-sm flex items-start gap-2 border-l-[3px] border-l-gold bg-gold/8 px-3 py-2 text-[10.5px] text-gold"
                    >
                      <AlertTriangle size={13} className="mt-0.5 flex-none" />
                      <span>{post.riskReasons.join(' ')}</span>
                    </div>
                  )}

                  {/* Media */}
                  {post.media.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {post.media.map((media) => (
                        <img
                          key={media.id}
                          src={media.directUrl}
                          alt={media.altText}
                          className="panel-cut-sm h-24 w-auto border border-paper/12 object-cover"
                        />
                      ))}
                    </div>
                  )}

                  {/* Role chips */}
                  {isRecruit && post.recruitment?.roleOpenings?.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {post.recruitment.roleOpenings.map((entry) => (
                        <span
                          key={`${post.id}-${entry.role}`}
                          className="panel-cut-sm inline-flex items-center gap-1.5 border border-paper/15 bg-ink/60 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-paper/70"
                        >
                          <Briefcase size={10} className="text-crimson" />
                          <strong className="text-paper">{entry.role}</strong>
                          <span className={post.recruitment?.paidWork ? 'text-gold' : 'text-mint'}>
                            {post.recruitment?.paidWork
                              ? entry.compensationAmount || t('feed.post.rolePayNegotiable')
                              : t('feed.post.rolePayVolunteer')}
                          </span>
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-1.5 border-t border-paper/8 pt-3">
                    {isRecruit && post.author.id !== currentUserId && (
                      <button
                        type="button"
                        className={`${feedBtn.primary} ${feedBtn.sm}`}
                        onClick={() => onApplyPost(post)}
                      >
                        <Send size={12} /> {t('feed.post.actions.apply')}
                      </button>
                    )}
                    <button
                      type="button"
                      className={`${feedBtn.ghost} ${feedBtn.sm}`}
                      onClick={() => onReportPost(post)}
                    >
                      <Flag size={11} /> {t('feed.post.actions.report')}
                    </button>
                    {canModerate && (
                      <>
                        <button
                          type="button"
                          className={`${feedBtn.ghost} ${feedBtn.sm}`}
                          onClick={() =>
                            onModerationPost(
                              post,
                              post.moderationStatus === 'hidden' ? 'clean' : 'hidden',
                            )
                          }
                        >
                          {post.moderationStatus === 'hidden'
                            ? t('feed.post.actions.show')
                            : t('feed.post.actions.hide')}
                        </button>
                        <button
                          type="button"
                          className={`${feedBtn.ghost} ${feedBtn.sm} !border-crimson/40 !text-crimson/80 hover:!bg-crimson hover:!text-ink`}
                          onClick={() => onStartBanFromPost(post)}
                        >
                          <Gavel size={11} /> {t('feed.post.actions.ban')}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
