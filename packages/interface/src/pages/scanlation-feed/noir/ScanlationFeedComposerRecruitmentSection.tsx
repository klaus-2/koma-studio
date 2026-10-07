'use client';

import type { Dispatch, SetStateAction } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Briefcase, Clock, DollarSign, FileText, MessageCircle, Star } from 'lucide-react';

import { useI18n } from '../../../i18n';
import {
  ComposerSection, FeedField, FeedInput, RequirementChip, ToggleSwitch, WeekdayPill,
} from './ScanlationFeedPrimitives';
import type { RecruitmentFormState } from '../ScanlationFeed.types';

type Props = {
  recruitmentForm: RecruitmentFormState;
  weekDayOptions: readonly string[];
  prefersReducedMotion: boolean;
  setRecruitmentForm: Dispatch<SetStateAction<RecruitmentFormState>>;
  onPaidWorkToggle: (value: boolean) => void;
  onRequirementPortfolioChange: () => void;
  onRequirementExperienceChange: () => void;
  onRequirementAvailabilityChange: () => void;
  onRequirementContactChange: () => void;
  onToggleRequirementAvailabilityDay: (day: string) => void;
};

export default function ScanlationFeedComposerRecruitmentSection({
  recruitmentForm, weekDayOptions, prefersReducedMotion,
  setRecruitmentForm, onPaidWorkToggle,
  onRequirementPortfolioChange, onRequirementExperienceChange,
  onRequirementAvailabilityChange, onRequirementContactChange,
  onToggleRequirementAvailabilityDay,
}: Props) {
  const { t } = useI18n();

  return (
    <ComposerSection icon={Star} label={t('feed.composer.sections.recruitmentSettings')}>
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

      <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-paper/45">
        {t('feed.composer.requirements.label')}
      </div>
      <div className="flex flex-wrap gap-1.5">
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

      <AnimatePresence>
        {recruitmentForm.candidateRequirements.availability && (
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="halftone panel-cut-sm flex flex-col gap-3 border-l-[3px] border-l-azure bg-azure/5 p-3.5"
          >
            <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-azure">
              <Clock size={12} /> {t('feed.composer.availability.minRequired')}
            </div>
            <FeedField label={t('feed.composer.availability.hoursPerWeek')}>
              <FeedInput
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
            </FeedField>
            <FeedField label={t('feed.composer.availability.daysOptional')}>
              <div className="flex flex-wrap gap-1.5">
                {weekDayOptions.map((d) => (
                  <WeekdayPill
                    key={d}
                    active={recruitmentForm.candidateRequirements.availabilityDays.includes(d)}
                    onClick={() => onToggleRequirementAvailabilityDay(d)}
                  >
                    {d}
                  </WeekdayPill>
                ))}
              </div>
            </FeedField>
            <FeedField label={t('feed.composer.availability.descriptionOptional')}>
              <textarea
                rows={2}
                className="noir-input min-h-0 resize-y !leading-relaxed"
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
              <span className="text-right font-mono text-[9px] text-paper/35">
                {recruitmentForm.candidateRequirements.availabilityDescription.length}/500
              </span>
            </FeedField>
          </motion.div>
        )}
      </AnimatePresence>
    </ComposerSection>
  );
}
