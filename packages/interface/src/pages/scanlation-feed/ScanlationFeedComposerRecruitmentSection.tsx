import type { Dispatch, SetStateAction } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Briefcase,
  Clock,
  DollarSign,
  FileText,
  MessageCircle,
  Star,
} from 'lucide-react';

import { useI18n } from '../../i18n';
import { RequirementChip, ToggleSwitch } from './ScanlationFeedPrimitives';
import type { RecruitmentFormState } from './ScanlationFeed.types';

type ScanlationFeedComposerRecruitmentSectionProps = {
  recruitmentForm: RecruitmentFormState;
  weekDayOptions: readonly string[];
  setRecruitmentForm: Dispatch<SetStateAction<RecruitmentFormState>>;
  onPaidWorkToggle: (value: boolean) => void;
  onRequirementPortfolioChange: (value: boolean) => void;
  onRequirementExperienceChange: (value: boolean) => void;
  onRequirementAvailabilityChange: (value: boolean) => void;
  onRequirementContactChange: (value: boolean) => void;
  onToggleRequirementAvailabilityDay: (day: string) => void;
};

export default function ScanlationFeedComposerRecruitmentSection({
  recruitmentForm,
  weekDayOptions,
  setRecruitmentForm,
  onPaidWorkToggle,
  onRequirementPortfolioChange,
  onRequirementExperienceChange,
  onRequirementAvailabilityChange,
  onRequirementContactChange,
  onToggleRequirementAvailabilityDay,
}: ScanlationFeedComposerRecruitmentSectionProps) {
  const { t } = useI18n();

  return (
    <div className="koma-feed-csection">
      <div className="koma-feed-csection__head">
        <div className="koma-feed-csection__icon">
          <Star size={14} />
        </div>
        <div className="koma-feed-csection__label">
          {t('feed.composer.sections.recruitmentSettings')}
        </div>
      </div>
      <ToggleSwitch
        checked
        onChange={() => undefined}
        label={t('feed.composer.toggle.recruiting')}
        description={t('feed.composer.toggle.recruitingDesc')}
        icon={Briefcase}
      />
      <ToggleSwitch
        checked={recruitmentForm.paidWork}
        onChange={onPaidWorkToggle}
        label={t('feed.composer.toggle.paidWork')}
        description={t('feed.composer.toggle.paidWorkDesc')}
        icon={DollarSign}
      />
      <div style={{ marginTop: 4 }}>
        <div className="koma-feed-field__label" style={{ marginBottom: 8 }}>
          {t('feed.composer.requirements.label')}
        </div>
        <div className="koma-feed-req-group">
          <RequirementChip
            checked={recruitmentForm.candidateRequirements.portfolio}
            onChange={onRequirementPortfolioChange}
            label={t('feed.composer.requirements.portfolio')}
            icon={FileText}
          />
          <RequirementChip
            checked={recruitmentForm.candidateRequirements.experience}
            onChange={onRequirementExperienceChange}
            label={t('feed.composer.requirements.experience')}
            icon={Star}
          />
          <RequirementChip
            checked={recruitmentForm.candidateRequirements.availability}
            onChange={onRequirementAvailabilityChange}
            label={t('feed.composer.requirements.availability')}
            icon={Clock}
          />
          <RequirementChip
            checked={recruitmentForm.candidateRequirements.contact}
            onChange={onRequirementContactChange}
            label={t('feed.composer.requirements.contact')}
            icon={MessageCircle}
          />
        </div>
      </div>
      <AnimatePresence>
        {recruitmentForm.candidateRequirements.availability && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="koma-feed-avail"
          >
            <div className="koma-feed-avail__hint">
              <Clock size={14} /> {t('feed.composer.availability.minRequired')}
            </div>
            <div className="koma-feed-field">
              <label className="koma-feed-field__label">
                {t('feed.composer.availability.hoursPerWeek')}
              </label>
              <input
                className="koma-feed-field__input"
                type="number"
                min="1"
                max="168"
                placeholder={t('feed.composer.availability.hoursPlaceholder')}
                value={recruitmentForm.candidateRequirements.availabilityHoursPerWeek}
                onChange={(e) =>
                  setRecruitmentForm((c) => ({
                    ...c,
                    candidateRequirements: {
                      ...c.candidateRequirements,
                      availabilityHoursPerWeek: e.target.value,
                    },
                  }))
                }
              />
            </div>
            <div className="koma-feed-field">
              <label className="koma-feed-field__label">
                {t('feed.composer.availability.daysOptional')}
              </label>
              <div className="koma-feed-weekdays">
                {weekDayOptions.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`koma-feed-weekday${recruitmentForm.candidateRequirements.availabilityDays.includes(d) ? ' koma-feed-weekday--active' : ''}`}
                    onClick={() => onToggleRequirementAvailabilityDay(d)}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="koma-feed-field">
              <label className="koma-feed-field__label">
                {t('feed.composer.availability.descriptionOptional')}
              </label>
              <textarea
                className="koma-feed-field__textarea"
                rows={2}
                value={recruitmentForm.candidateRequirements.availabilityDescription}
                onChange={(e) =>
                  setRecruitmentForm((c) => ({
                    ...c,
                    candidateRequirements: {
                      ...c.candidateRequirements,
                      availabilityDescription: e.target.value.slice(0, 500),
                    },
                  }))
                }
                placeholder={t('feed.composer.availability.placeholder')}
              />
              <div className="koma-feed-field__char-count">
                {recruitmentForm.candidateRequirements.availabilityDescription.length}
                /500
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
