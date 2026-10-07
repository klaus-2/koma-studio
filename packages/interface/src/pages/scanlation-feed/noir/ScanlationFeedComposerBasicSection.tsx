'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Briefcase, FileText } from 'lucide-react';

import { useI18n } from '../../../i18n';
import {
  ComposerSection, FeedField, FeedInput, FeedTextarea,
} from './ScanlationFeedPrimitives';
import type { RecruitmentFormState, ShowcaseFormState } from '../ScanlationFeed.types';

type Props = {
  tab: 'recruitment' | 'showcase';
  recruitmentForm: RecruitmentFormState;
  showcaseForm: ShowcaseFormState;
  setRecruitmentForm: Dispatch<SetStateAction<RecruitmentFormState>>;
  setShowcaseForm: Dispatch<SetStateAction<ShowcaseFormState>>;
};

export default function ScanlationFeedComposerBasicSection({
  tab, recruitmentForm, showcaseForm, setRecruitmentForm, setShowcaseForm,
}: Props) {
  const { t } = useI18n();

  return (
    <>
      {/* Basic info */}
      <ComposerSection icon={FileText} label={t('common.basicInfo')}>
        <div className="flex flex-wrap gap-3">
          <FeedField label={t('common.title')}>
            <FeedInput
              value={tab === 'recruitment' ? recruitmentForm.title : showcaseForm.title}
              onChange={(e) =>
                tab === 'recruitment'
                  ? setRecruitmentForm((c) => ({ ...c, title: e.target.value }))
                  : setShowcaseForm((c) => ({ ...c, title: e.target.value }))
              }
              placeholder={
                tab === 'recruitment'
                  ? t('feed.composer.placeholder.titleRecruit')
                  : t('feed.composer.placeholder.titleShowcase')
              }
            />
          </FeedField>
          <FeedField label={t('common.summary')}>
            <FeedInput
              value={tab === 'recruitment' ? recruitmentForm.summary : showcaseForm.summary}
              onChange={(e) =>
                tab === 'recruitment'
                  ? setRecruitmentForm((c) => ({ ...c, summary: e.target.value }))
                  : setShowcaseForm((c) => ({ ...c, summary: e.target.value }))
              }
              placeholder={t('common.summaryPlaceholder')}
            />
          </FeedField>
        </div>
        <FeedField label={t('common.mainDescription')}>
          <FeedTextarea
            rows={4}
            value={tab === 'recruitment' ? recruitmentForm.body : showcaseForm.body}
            onChange={(e) =>
              tab === 'recruitment'
                ? setRecruitmentForm((c) => ({ ...c, body: e.target.value }))
                : setShowcaseForm((c) => ({ ...c, body: e.target.value }))
            }
            placeholder={
              tab === 'recruitment'
                ? t('feed.composer.placeholder.bodyRecruit')
                : t('feed.composer.placeholder.bodyShowcase')
            }
          />
        </FeedField>
      </ComposerSection>

      {/* Project / Work */}
      <ComposerSection
        icon={Briefcase}
        label={tab === 'recruitment' ? t('feed.composer.sections.project') : t('feed.composer.sections.work')}
      >
        <div className="flex flex-wrap gap-3">
          <FeedField label={t('feed.composer.label.scanlation')}>
            <FeedInput
              value={tab === 'recruitment' ? recruitmentForm.scanlationName : showcaseForm.scanlationName}
              onChange={(e) =>
                tab === 'recruitment'
                  ? setRecruitmentForm((c) => ({ ...c, scanlationName: e.target.value }))
                  : setShowcaseForm((c) => ({ ...c, scanlationName: e.target.value }))
              }
              placeholder={t('feed.composer.placeholder.scanlationName')}
            />
          </FeedField>
          <FeedField label={t('feed.composer.sections.work')}>
            <FeedInput
              value={tab === 'recruitment' ? recruitmentForm.workTitle : showcaseForm.workTitle}
              onChange={(e) =>
                tab === 'recruitment'
                  ? setRecruitmentForm((c) => ({ ...c, workTitle: e.target.value }))
                  : setShowcaseForm((c) => ({ ...c, workTitle: e.target.value }))
              }
              placeholder={t('feed.composer.placeholder.workTitle')}
            />
          </FeedField>
        </div>
        {tab === 'showcase' && (
          <>
            <div className="flex flex-wrap gap-3">
              <FeedField label={t('common.chapter')}>
                <FeedInput
                  value={showcaseForm.chapterLabel}
                  onChange={(e) => setShowcaseForm((c) => ({ ...c, chapterLabel: e.target.value }))}
                  placeholder={t('feed.composer.placeholder.chapterLabel')}
                />
              </FeedField>
              <FeedField label={t('common.genres')}>
                <FeedInput
                  value={showcaseForm.genres}
                  onChange={(e) => setShowcaseForm((c) => ({ ...c, genres: e.target.value }))}
                  placeholder={t('feed.composer.placeholder.genres')}
                />
              </FeedField>
            </div>
            <FeedField label={t('common.editorialDescription')}>
              <FeedTextarea
                rows={3}
                value={showcaseForm.description}
                onChange={(e) => setShowcaseForm((c) => ({ ...c, description: e.target.value }))}
                placeholder={t('feed.composer.placeholder.description')}
              />
            </FeedField>
          </>
        )}
      </ComposerSection>
    </>
  );
}
