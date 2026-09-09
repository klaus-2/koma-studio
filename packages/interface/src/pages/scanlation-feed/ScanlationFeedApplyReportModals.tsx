import type { Dispatch, SetStateAction } from 'react';
import { Flag, Send } from 'lucide-react';

import { useI18n } from '../../i18n';
import type { FeedPost } from '../../services/scanlationFeed';
import { FeedModal } from './ScanlationFeedPrimitives';
import type {
  ApplicationFormState,
  ReportFormState,
} from './ScanlationFeed.types';

type ReportReasonOption = {
  key: string;
  label: string;
};

type ScanlationFeedApplyReportModalsProps = {
  applyingPost: FeedPost | null;
  reportingPost: FeedPost | null;
  applicationForm: ApplicationFormState;
  reportForm: ReportFormState;
  weekDayOptions: readonly string[];
  reportReasons: readonly ReportReasonOption[];
  applyPending: boolean;
  reportPending: boolean;
  setApplyingPost: (post: FeedPost | null) => void;
  setReportingPost: (post: FeedPost | null) => void;
  setApplicationForm: Dispatch<SetStateAction<ApplicationFormState>>;
  setReportForm: Dispatch<SetStateAction<ReportFormState>>;
  onApply: () => void;
  onReport: () => void;
};

export default function ScanlationFeedApplyReportModals({
  applyingPost,
  reportingPost,
  applicationForm,
  reportForm,
  weekDayOptions,
  reportReasons,
  applyPending,
  reportPending,
  setApplyingPost,
  setReportingPost,
  setApplicationForm,
  setReportForm,
  onApply,
  onReport,
}: ScanlationFeedApplyReportModalsProps) {
  const { t } = useI18n();

  return (
    <>
      <FeedModal
        title={t('feed.apply.title')}
        open={Boolean(applyingPost)}
        onClose={() => setApplyingPost(null)}
        icon={Send}
      >
        <div className="koma-feed-modal-body">
          <div className="koma-feed-field">
            <label className="koma-feed-field__label">{t('feed.apply.message')}</label>
            <textarea
              className="koma-feed-field__textarea"
              value={applicationForm.message}
              onChange={(e) =>
                setApplicationForm((c) => ({ ...c, message: e.target.value }))
              }
              rows={4}
              placeholder={t('feed.apply.messagePlaceholder')}
            />
          </div>
          {applyingPost?.recruitment?.candidateRequirements.experience && (
            <div className="koma-feed-field">
              <label className="koma-feed-field__label">{t('feed.composer.requirements.experience')}</label>
              <textarea
                className="koma-feed-field__textarea"
                rows={3}
                value={applicationForm.experience}
                onChange={(e) =>
                  setApplicationForm((c) => ({
                    ...c,
                    experience: e.target.value,
                  }))
                }
              />
            </div>
          )}
          {applyingPost?.recruitment?.candidateRequirements.availability && (
            <>
              <div className="koma-feed-field">
                <label className="koma-feed-field__label">
                  {t('feed.composer.availability.hoursPerWeek')}
                </label>
                <input
                  className="koma-feed-field__input"
                  type="number"
                  value={applicationForm.availabilityHoursPerWeek}
                  onChange={(e) =>
                    setApplicationForm((c) => ({
                      ...c,
                      availabilityHoursPerWeek: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="koma-feed-weekdays">
                {weekDayOptions.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`koma-feed-weekday${applicationForm.availabilityDays.includes(d) ? ' koma-feed-weekday--active' : ''}`}
                    onClick={() =>
                      setApplicationForm((c) => ({
                        ...c,
                        availabilityDays: c.availabilityDays.includes(d)
                          ? c.availabilityDays.filter((x) => x !== d)
                          : [...c.availabilityDays, d],
                      }))
                    }
                  >
                    {d}
                  </button>
                ))}
              </div>
              <div className="koma-feed-field">
                <label className="koma-feed-field__label">
                  {t('feed.composer.availability.descriptionOptional')}
                </label>
                <textarea
                  className="koma-feed-field__textarea"
                  value={applicationForm.availabilityDescription}
                  onChange={(e) =>
                    setApplicationForm((c) => ({
                      ...c,
                      availabilityDescription: e.target.value,
                    }))
                  }
                  rows={2}
                />
              </div>
            </>
          )}
          {applyingPost?.recruitment?.candidateRequirements.contact && (
            <div className="koma-feed-field">
              <label className="koma-feed-field__label">
                {t('feed.apply.preferredContact')}
              </label>
              <input
                className="koma-feed-field__input"
                value={applicationForm.preferredContactValue}
                onChange={(e) =>
                  setApplicationForm((c) => ({
                    ...c,
                    preferredContactValue: e.target.value,
                  }))
                }
                placeholder={t('feed.apply.contactPlaceholder')}
              />
            </div>
          )}
          {applyingPost?.recruitment?.candidateRequirements.portfolio && (
            <div className="koma-feed-field">
              <label className="koma-feed-field__label">
                {t('feed.apply.portfolio')}
              </label>
              <textarea
                className="koma-feed-field__textarea"
                rows={3}
                value={applicationForm.portfolioLinks}
                onChange={(e) =>
                  setApplicationForm((c) => ({
                    ...c,
                    portfolioLinks: e.target.value,
                  }))
                }
                placeholder={t('feed.apply.portfolioPlaceholder')}
              />
            </div>
          )}
        </div>
        <div className="koma-feed-modal-footer">
          <button
            type="button"
            className="koma-feed-btn koma-feed-btn--ghost"
            onClick={() => setApplyingPost(null)}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="koma-feed-btn koma-feed-btn--primary"
            onClick={onApply}
            disabled={applyPending}
          >
            <Send size={14} /> {t('feed.apply.title')}
          </button>
        </div>
      </FeedModal>

      <FeedModal
        title={t('feed.report.title')}
        open={Boolean(reportingPost)}
        onClose={() => setReportingPost(null)}
        icon={Flag}
      >
        <div className="koma-feed-modal-body">
          <div className="koma-feed-field">
            <label className="koma-feed-field__label">{t('feed.report.reason')}</label>
            <select
              className="koma-feed-field__select"
              value={reportForm.reasonCode}
              onChange={(e) =>
                setReportForm((c) => ({ ...c, reasonCode: e.target.value }))
              }
            >
              {reportReasons.map((r) => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="koma-feed-field">
            <label className="koma-feed-field__label">{t('feed.report.details')}</label>
            <textarea
              className="koma-feed-field__textarea"
              rows={4}
              value={reportForm.details}
              onChange={(e) =>
                setReportForm((c) => ({ ...c, details: e.target.value }))
              }
              placeholder={t('feed.report.detailsPlaceholder')}
            />
          </div>
        </div>
        <div className="koma-feed-modal-footer">
          <button
            type="button"
            className="koma-feed-btn koma-feed-btn--ghost"
            onClick={() => setReportingPost(null)}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="koma-feed-btn koma-feed-btn--primary"
            onClick={onReport}
            disabled={reportPending}
          >
            <Flag size={14} /> {t('feed.report.send')}
          </button>
        </div>
      </FeedModal>
    </>
  );
}
