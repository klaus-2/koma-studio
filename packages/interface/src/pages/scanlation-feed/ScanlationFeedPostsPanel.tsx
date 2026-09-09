import {
  AlertTriangle,
  Briefcase,
  Flag,
  Gavel,
  Megaphone,
  Plus,
  Send,
  Users,
} from 'lucide-react';

import { useI18n } from '../../i18n';
import type { FeedPost } from '../../services/scanlationFeed';
import type { FeedTab } from './ScanlationFeed.types';

type ScanlationFeedPostsPanelProps = {
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
  onModerationPost: (
    post: FeedPost,
    status: FeedPost['moderationStatus'],
  ) => void;
  onStartBanFromPost: (post: FeedPost) => void;
};

export default function ScanlationFeedPostsPanel({
  tab,
  canModerate,
  loading,
  currentUserId,
  visiblePosts,
  formattedVisiblePostDates,
  composerTypeLabel,
  onOpenComposer,
  onApplyPost,
  onReportPost,
  onModerationPost,
  onStartBanFromPost,
}: ScanlationFeedPostsPanelProps) {
  const { t } = useI18n();

  return (
    <div className="koma-feed__main">
      <div className="koma-feed-card">
        <div className="koma-feed-card__header">
          <div className="koma-feed-card__header-icon">
            {tab === 'recruitment' ? (
              <Users size={16} />
            ) : tab === 'showcase' ? (
              <Megaphone size={16} />
            ) : (
              <Gavel size={16} />
            )}
          </div>
          <div className="koma-feed-card__title">
            {tab === 'recruitment'
              ? t('feed.card.recruitmentRecent')
              : tab === 'showcase'
                ? t('feed.card.showcaseRecent')
                : t('feed.card.moderationQueue')}
          </div>
          <div className="koma-feed-card__count">{visiblePosts.length}</div>
        </div>

        {loading ? (
          <div className="koma-feed-loading" role="status">
            <div className="koma-feed-spinner" /> {t('feed.loading')}
          </div>
        ) : visiblePosts.length === 0 ? (
          <div className="koma-feed-empty">
            <div className="koma-feed-empty__icon">
              {tab === 'recruitment' ? (
                <Users size={24} />
              ) : (
                <Megaphone size={24} />
              )}
            </div>
            <div className="koma-feed-empty__title">
              {tab === 'recruitment'
                ? t('feed.empty.noRecruitment')
                : tab === 'showcase'
                  ? t('feed.empty.noShowcase')
                  : t('feed.empty.cleanQueue')}
            </div>
            <div className="koma-feed-empty__desc">
              {tab !== 'moderation'
                ? t('feed.empty.beFirst', {
                    type: composerTypeLabel.toLowerCase(),
                  })
                : t('feed.empty.noModPosts')}
            </div>
            {tab !== 'moderation' && (
              <button
                type="button"
                className="koma-feed-btn koma-feed-btn--primary"
                onClick={onOpenComposer}
              >
                <Plus size={15} />{' '}
                {t('feed.actions.createPost', {
                  type: composerTypeLabel.toLowerCase(),
                })}
              </button>
            )}
          </div>
        ) : (
          <div className="koma-feed-posts">
            {visiblePosts.map((post) => (
              <article key={post.id} className="koma-feed-post">
                <div
                  className={`koma-feed-post__accent${post.type === 'showcase' ? ' koma-feed-post__accent--showcase' : ''}`}
                  aria-hidden="true"
                />
                <div className="koma-feed-post__inner">
                  <div className="koma-feed-post__header">
                    <div className="koma-feed-post__avatar">
                      {post.author.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="koma-feed-post__header-info">
                      <div className="koma-feed-post__author">
                        {post.author.name}
                      </div>
                      <div className="koma-feed-post__date">
                        {formattedVisiblePostDates.get(post.id)}
                      </div>
                    </div>
                    <span className="koma-feed-pill koma-feed-pill--active koma-feed-pill--type">
                      {post.type === 'recruitment'
                        ? t('feed.post.recruitLabel')
                        : t('feed.post.showcaseLabel')}
                    </span>
                  </div>

                  <h2 className="koma-feed-post__title">{post.title}</h2>
                  {post.summary && (
                    <p className="koma-feed-post__summary">{post.summary}</p>
                  )}
                  <p className="koma-feed-post__body">{post.body}</p>

                  {canModerate && post.riskReasons.length > 0 && (
                    <div className="koma-feed-post__warning" role="alert">
                      <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                      <span>{post.riskReasons.join(' ')}</span>
                    </div>
                  )}

                  {post.media.length > 0 && (
                    <div className="koma-feed-media">
                      {post.media.map((media) => (
                        <div key={media.id} className="koma-feed-media__item">
                          <img
                            className="koma-feed-media__img"
                            src={media.directUrl}
                            alt={media.altText}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {post.type === 'recruitment' &&
                  post.recruitment?.roleOpenings?.length ? (
                    <div className="koma-feed-post__roles">
                      {post.recruitment.roleOpenings.map((entry) => (
                        <div
                          key={`${post.id}-${entry.role}`}
                          className="koma-feed-post__role-chip"
                        >
                          <Briefcase size={11} />
                          <strong>{entry.role}</strong>
                          <span className="koma-feed-post__role-pay">
                            {post.recruitment?.paidWork
                              ? entry.compensationAmount ||
                                t('feed.post.rolePayNegotiable')
                              : t('feed.post.rolePayVolunteer')}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="koma-feed-post__actions">
                    {post.type === 'recruitment' &&
                      post.author.id !== currentUserId && (
                        <button
                          type="button"
                          className="koma-feed-btn koma-feed-btn--primary koma-feed-btn--sm"
                          onClick={() => onApplyPost(post)}
                        >
                          <Send size={13} /> {t('feed.post.actions.apply')}
                        </button>
                      )}
                    <button
                      type="button"
                      className="koma-feed-btn koma-feed-btn--ghost koma-feed-btn--sm"
                      onClick={() => onReportPost(post)}
                    >
                      <Flag size={13} /> {t('feed.post.actions.report')}
                    </button>
                    {canModerate && (
                      <>
                        <button
                          type="button"
                          className="koma-feed-btn koma-feed-btn--ghost koma-feed-btn--sm"
                          onClick={() =>
                            onModerationPost(
                              post,
                              post.moderationStatus === 'hidden'
                                ? 'clean'
                                : 'hidden',
                            )
                          }
                        >
                          {post.moderationStatus === 'hidden'
                            ? t('feed.post.actions.show')
                            : t('feed.post.actions.hide')}
                        </button>
                        <button
                          type="button"
                          className="koma-feed-btn koma-feed-btn--ghost koma-feed-btn--sm"
                          onClick={() => onStartBanFromPost(post)}
                        >
                          <Gavel size={13} /> {t('feed.post.actions.ban')}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
