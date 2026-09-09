import {
  AlertTriangle,
  ArrowLeft,
  Gavel,
  Megaphone,
  Plus,
  ShieldAlert,
  Users,
} from 'lucide-react';

import { useI18n } from '../../i18n';
import type { FeedTab } from './ScanlationFeed.types';

type ScanlationFeedHeaderToolbarProps = {
  tab: FeedTab;
  canModerate: boolean;
  heroTitle: string;
  composerTypeLabel: string;
  feedback: string | null;
  error: string | null;
  onBackDashboard: () => void;
  onTabChange: (tab: FeedTab) => void;
  onOpenComposer: () => void;
};

export default function ScanlationFeedHeaderToolbar({
  tab,
  canModerate,
  heroTitle,
  composerTypeLabel,
  feedback,
  error,
  onBackDashboard,
  onTabChange,
  onOpenComposer,
}: ScanlationFeedHeaderToolbarProps) {
  const { t } = useI18n();

  return (
    <>
      <header className="koma-feed__hero">
        <button
          type="button"
          className="koma-feed__back"
          onClick={onBackDashboard}
        >
          <ArrowLeft size={15} /> {t('feed.hero.back')}
        </button>
        <div className="koma-feed__hero-body">
          <div className="koma-feed__hero-text">
            <div className="koma-feed__badge">
              <span className="koma-feed__badge-dot" aria-hidden="true" />
              {t('dashboard.topbar.scanlationFeed')}
            </div>
            <h1 className="koma-feed__title">{heroTitle}</h1>
            <p className="koma-feed__subtitle">{t('feed.hero.subtitle')}</p>
          </div>
        </div>
      </header>

      <div className="koma-feed__toolbar">
        <nav
          className="koma-feed__tabs"
          role="tablist"
          aria-label={t('feed.tabsAria')}
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'recruitment'}
            className={`koma-feed__tab${tab === 'recruitment' ? ' koma-feed__tab--active' : ''}`}
            onClick={() => onTabChange('recruitment')}
          >
            <span className="koma-feed__tab-icon">
              <Users size={15} />
            </span>{' '}
            {t('feed.tab.recruitment')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'showcase'}
            className={`koma-feed__tab${tab === 'showcase' ? ' koma-feed__tab--active' : ''}`}
            onClick={() => onTabChange('showcase')}
          >
            <span className="koma-feed__tab-icon">
              <Megaphone size={15} />
            </span>{' '}
            {t('feed.tab.showcase')}
          </button>
          {canModerate && (
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'moderation'}
              className={`koma-feed__tab${tab === 'moderation' ? ' koma-feed__tab--active' : ''}`}
              onClick={() => onTabChange('moderation')}
            >
              <span className="koma-feed__tab-icon">
                <Gavel size={15} />
              </span>{' '}
              {t('feed.tab.moderation')}
            </button>
          )}
        </nav>
        {tab !== 'moderation' && (
          <div className="koma-feed__toolbar-right">
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
          </div>
        )}
      </div>

      <div className="koma-feed__alerts">
        <div className="koma-feed-alert koma-feed-alert--warning" role="alert">
          <ShieldAlert size={16} className="koma-feed-alert__icon" />
          <span>{t('feed.alert.safety')}</span>
        </div>
        {canModerate && (
          <div className="koma-feed-alert koma-feed-alert--info" role="note">
            <AlertTriangle size={16} className="koma-feed-alert__icon" />
            <span>{t('feed.alert.banPolicy')}</span>
          </div>
        )}
      </div>

      {feedback && (
        <div className="koma-feed-toast koma-feed-toast--success" role="status">
          {feedback}
        </div>
      )}
      {error && (
        <div className="koma-feed-toast koma-feed-toast--error" role="alert">
          {error}
        </div>
      )}
    </>
  );
}
