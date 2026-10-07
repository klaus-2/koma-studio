'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Flag, Send } from 'lucide-react';

import { useI18n } from '../../../i18n';
import type { FeedPost } from '../../../services/scanlationFeed';
import {
  FeedModal, FeedField, FeedInput, FeedTextarea, FeedSelect,
  WeekdayPill, feedBtn,
} from './ScanlationFeedPrimitives';
import type { ApplicationFormState, ReportFormState } from '../ScanlationFeed.types';

type ReportReasonOption = { key: string; label: string };

type Props = {
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
  applyingPost, reportingPost, applicationForm, reportForm,
  weekDayOptions, reportReasons, applyPending, reportPending,
  setApplyingPost, setReportingPost, setApplicationForm, setReportForm,
  onApply, onReport,
}: Props) {
  const { t } = useI18n();

  const footer = (onCancel: () => void, action: React.ReactNode) => (
    <div className="flex justify-end gap-2 border-t border-paper/10 px-5 py-4">
      <button type="button" className={feedBtn.ghost} onClick={onCancel}>
        {t('common.cancel')}
      </button>
      {action}
    </div>
  );

  return (
    <>
      {/* ═══ Apply ═══ */}
      <FeedModal
        title={t('feed.apply.title')}
        open={Boolean(applyingPost)}
        onClose={() => setApplyingPost(null)}
        icon={Send}
      >
        <div className="flex flex-col gap-4 p-5">
          <FeedField label={t('feed.apply.message')}>
            <FeedTextarea
              rows={4}
              value={applicationForm.message}
              onChange={(e) => setApplicationForm((c) => ({ ...c, message: e.target.value }))}
              placeholder={t('feed.apply.messagePlaceholder')}
            />
          </FeedField>

          {applyingPost?.recruitment?.candidateRequirements.experience && (
            <FeedField label={t('feed.composer.requirements.experience')}>
              <FeedTextarea
                rows={3}
                value={applicationForm.experience}
                onChange={(e) => setApplicationForm((c) => ({ ...c, experience: e.target.value }))}
              />
            </FeedField>
          )}

          {applyingPost?.recruitment?.candidateRequirements.availability && (
            <>
              <FeedField label={t('feed.composer.availability.hoursPerWeek')}>
                <FeedInput
                  type="number"
                  value={applicationForm.availabilityHoursPerWeek}
                  onChange={(e) =>
                    setApplicationForm((c) => ({ ...c, availabilityHoursPerWeek: e.target.value }))
                  }
                />
              </FeedField>
              <div className="flex flex-wrap gap-1.5">
                {weekDayOptions.map((d) => (
                  <WeekdayPill
                    key={d}
                    active={applicationForm.availabilityDays.includes(d)}
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
                  </WeekdayPill>
                ))}
              </div>
              <FeedField label={t('feed.composer.availability.descriptionOptional')}>
                <FeedTextarea
                  rows={2}
                  value={applicationForm.availabilityDescription}
                  onChange={(e) =>
                    setApplicationForm((c) => ({ ...c, availabilityDescription: e.target.value }))
                  }
                />
              </FeedField>
            </>
          )}

          {applyingPost?.recruitment?.candidateRequirements.contact && (
            <FeedField label={t('feed.apply.preferredContact')}>
              <FeedInput
                value={applicationForm.preferredContactValue}
                onChange={(e) =>
                  setApplicationForm((c) => ({ ...c, preferredContactValue: e.target.value }))
                }
                placeholder={t('feed.apply.contactPlaceholder')}
              />
            </FeedField>
          )}

          {applyingPost?.recruitment?.candidateRequirements.portfolio && (
            <FeedField label={t('feed.apply.portfolio')}>
              <FeedTextarea
                rows={3}
                value={applicationForm.portfolioLinks}
                onChange={(e) =>
                  setApplicationForm((c) => ({ ...c, portfolioLinks: e.target.value }))
                }
                placeholder={t('feed.apply.portfolioPlaceholder')}
              />
            </FeedField>
          )}
        </div>
        {footer(
          () => setApplyingPost(null),
          <button type="button" className={feedBtn.primary} onClick={onApply} disabled={applyPending}>
            <Send size={13} /> {t('feed.apply.title')}
            <span aria-hidden className="font-accent text-[13px] normal-case italic tracking-normal opacity-70">
              応募
            </span>
          </button>,
        )}
      </FeedModal>

      {/* ═══ Report ═══ */}
      <FeedModal
        title={t('feed.report.title')}
        open={Boolean(reportingPost)}
        onClose={() => setReportingPost(null)}
        icon={Flag}
      >
        <div className="flex flex-col gap-4 p-5">
          <FeedField label={t('feed.report.reason')}>
            <FeedSelect
              value={reportForm.reasonCode}
              onChange={(e) => setReportForm((c) => ({ ...c, reasonCode: e.target.value }))}
            >
              {reportReasons.map((r) => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </FeedSelect>
          </FeedField>
          <FeedField label={t('feed.report.details')}>
            <FeedTextarea
              rows={4}
              value={reportForm.details}
              onChange={(e) => setReportForm((c) => ({ ...c, details: e.target.value }))}
              placeholder={t('feed.report.detailsPlaceholder')}
            />
          </FeedField>
        </div>
        {footer(
          () => setReportingPost(null),
          <button type="button" className={feedBtn.primary} onClick={onReport} disabled={reportPending}>
            <Flag size={13} /> {t('feed.report.send')}
            <span aria-hidden className="font-accent text-[13px] normal-case italic tracking-normal opacity-70">
              通報
            </span>
          </button>,
        )}
      </FeedModal>
    </>
  );
}
