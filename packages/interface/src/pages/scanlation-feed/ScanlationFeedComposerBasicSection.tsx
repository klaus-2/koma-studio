import type { Dispatch, SetStateAction } from 'react';
import { Briefcase, FileText } from 'lucide-react';

import { useI18n } from '../../i18n';
import type {
  FeedTab,
  RecruitmentFormState,
  ShowcaseFormState,
} from './ScanlationFeed.types';

type ScanlationFeedComposerBasicSectionProps = {
  tab: FeedTab;
  recruitmentForm: RecruitmentFormState;
  showcaseForm: ShowcaseFormState;
  setRecruitmentForm: Dispatch<SetStateAction<RecruitmentFormState>>;
  setShowcaseForm: Dispatch<SetStateAction<ShowcaseFormState>>;
};

export default function ScanlationFeedComposerBasicSection({
  tab,
  recruitmentForm,
  showcaseForm,
  setRecruitmentForm,
  setShowcaseForm,
}: ScanlationFeedComposerBasicSectionProps) {
  const { t } = useI18n();
  const isRecruitment = tab === 'recruitment';

  return (
    <>
      <div className="koma-feed-csection">
        <div className="koma-feed-csection__head">
          <div className="koma-feed-csection__icon">
            <FileText size={14} />
          </div>
          <div className="koma-feed-csection__label">
            {t('common.basicInfo')}
          </div>
        </div>
        <div className="koma-feed-csection__row">
          <div className="koma-feed-field">
            <label className="koma-feed-field__label">{t('common.title')}</label>
            <input
              className="koma-feed-field__input"
              value={isRecruitment ? recruitmentForm.title : showcaseForm.title}
              onChange={(e) =>
                isRecruitment
                  ? setRecruitmentForm((c) => ({ ...c, title: e.target.value }))
                  : setShowcaseForm((c) => ({ ...c, title: e.target.value }))
              }
              placeholder={
                isRecruitment
                  ? t('feed.composer.placeholder.titleRecruit')
                  : t('feed.composer.placeholder.titleShowcase')
              }
            />
          </div>
          <div className="koma-feed-field">
            <label className="koma-feed-field__label">{t('common.summary')}</label>
            <input
              className="koma-feed-field__input"
              value={isRecruitment ? recruitmentForm.summary : showcaseForm.summary}
              onChange={(e) =>
                isRecruitment
                  ? setRecruitmentForm((c) => ({ ...c, summary: e.target.value }))
                  : setShowcaseForm((c) => ({ ...c, summary: e.target.value }))
              }
              placeholder={t('common.summaryPlaceholder')}
            />
          </div>
        </div>
        <div className="koma-feed-csection__row koma-feed-csection__row--single">
          <div className="koma-feed-field">
            <label className="koma-feed-field__label">
              {t('common.mainDescription')}
            </label>
            <textarea
              className="koma-feed-field__textarea"
              rows={4}
              value={isRecruitment ? recruitmentForm.body : showcaseForm.body}
              onChange={(e) =>
                isRecruitment
                  ? setRecruitmentForm((c) => ({ ...c, body: e.target.value }))
                  : setShowcaseForm((c) => ({ ...c, body: e.target.value }))
              }
              placeholder={
                isRecruitment
                  ? t('feed.composer.placeholder.bodyRecruit')
                  : t('feed.composer.placeholder.bodyShowcase')
              }
            />
          </div>
        </div>
      </div>

      <div className="koma-feed-csection">
        <div className="koma-feed-csection__head">
          <div className="koma-feed-csection__icon">
            <Briefcase size={14} />
          </div>
          <div className="koma-feed-csection__label">
            {isRecruitment
              ? t('feed.composer.sections.project')
              : t('feed.composer.sections.work')}
          </div>
        </div>
        <div className="koma-feed-csection__row">
          <div className="koma-feed-field">
            <label className="koma-feed-field__label">
              {t('feed.composer.label.scanlation')}
            </label>
            <input
              className="koma-feed-field__input"
              value={
                isRecruitment
                  ? recruitmentForm.scanlationName
                  : showcaseForm.scanlationName
              }
              onChange={(e) =>
                isRecruitment
                  ? setRecruitmentForm((c) => ({
                      ...c,
                      scanlationName: e.target.value,
                    }))
                  : setShowcaseForm((c) => ({
                      ...c,
                      scanlationName: e.target.value,
                    }))
              }
              placeholder={t('feed.composer.placeholder.scanlationName')}
            />
          </div>
          <div className="koma-feed-field">
            <label className="koma-feed-field__label">
              {t('feed.composer.sections.work')}
            </label>
            <input
              className="koma-feed-field__input"
              value={isRecruitment ? recruitmentForm.workTitle : showcaseForm.workTitle}
              onChange={(e) =>
                isRecruitment
                  ? setRecruitmentForm((c) => ({
                      ...c,
                      workTitle: e.target.value,
                    }))
                  : setShowcaseForm((c) => ({
                      ...c,
                      workTitle: e.target.value,
                    }))
              }
              placeholder={t('feed.composer.placeholder.workTitle')}
            />
          </div>
        </div>
        {tab === 'showcase' && (
          <>
            <div className="koma-feed-csection__row">
              <div className="koma-feed-field">
                <label className="koma-feed-field__label">
                  {t('common.chapter')}
                </label>
                <input
                  className="koma-feed-field__input"
                  value={showcaseForm.chapterLabel}
                  onChange={(e) =>
                    setShowcaseForm((c) => ({
                      ...c,
                      chapterLabel: e.target.value,
                    }))
                  }
                  placeholder={t('feed.composer.placeholder.chapterLabel')}
                />
              </div>
              <div className="koma-feed-field">
                <label className="koma-feed-field__label">{t('common.genres')}</label>
                <input
                  className="koma-feed-field__input"
                  value={showcaseForm.genres}
                  onChange={(e) =>
                    setShowcaseForm((c) => ({ ...c, genres: e.target.value }))
                  }
                  placeholder={t('feed.composer.placeholder.genres')}
                />
              </div>
            </div>
            <div className="koma-feed-csection__row koma-feed-csection__row--single">
              <div className="koma-feed-field">
                <label className="koma-feed-field__label">
                  {t('common.editorialDescription')}
                </label>
                <textarea
                  className="koma-feed-field__textarea"
                  rows={3}
                  value={showcaseForm.description}
                  onChange={(e) =>
                    setShowcaseForm((c) => ({
                      ...c,
                      description: e.target.value,
                    }))
                  }
                  placeholder={t('feed.composer.placeholder.description')}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
