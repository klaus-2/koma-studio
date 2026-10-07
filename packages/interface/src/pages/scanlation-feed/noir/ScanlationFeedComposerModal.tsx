'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Send } from 'lucide-react';

import { useI18n } from '../../../i18n';
import { FeedModal, feedBtn } from './ScanlationFeedPrimitives';
import type {
  ContactPlatformKey, RecruitmentFormState,
  RecruitmentRoleOption, RecruitmentRoleValue, ShowcaseFormState,
  SocialPlatformOption,
} from '../ScanlationFeed.types';
import type { FeedPostMediaItem } from '../../../services/scanlationFeed';
import ScanlationFeedComposerBasicSection from './ScanlationFeedComposerBasicSection';
import ScanlationFeedComposerMediaSection from './ScanlationFeedComposerMediaSection';
import ScanlationFeedComposerRecruitmentSection from './ScanlationFeedComposerRecruitmentSection';
import ScanlationFeedComposerRolesSection from './ScanlationFeedComposerRolesSection';
import ScanlationFeedComposerSocialSection from './ScanlationFeedComposerSocialSection';

type Props = {
  open: boolean;
  tab: 'recruitment' | 'showcase';
  composerTypeLabel: string;
  recruitmentForm: RecruitmentFormState;
  showcaseForm: ShowcaseFormState;
  mediaItems: FeedPostMediaItem[];
  uploading: boolean;
  weekDayOptions: readonly string[];
  recruitmentRoles: readonly RecruitmentRoleOption[];
  socialPlatforms: readonly SocialPlatformOption[];
  recruitmentRoleByValue: ReadonlyMap<RecruitmentRoleValue, RecruitmentRoleOption>;
  socialPlatformByValue: ReadonlyMap<ContactPlatformKey, SocialPlatformOption>;
  prefersReducedMotion: boolean;
  setOpen: (open: boolean) => void;
  setRecruitmentForm: Dispatch<SetStateAction<RecruitmentFormState>>;
  setShowcaseForm: Dispatch<SetStateAction<ShowcaseFormState>>;
  onPaidWorkToggle: (value: boolean) => void;
  onRequirementPortfolioChange: () => void;
  onRequirementExperienceChange: () => void;
  onRequirementAvailabilityChange: () => void;
  onRequirementContactChange: () => void;
  onToggleRequirementAvailabilityDay: (day: string) => void;
  onAddRoleOpening: () => void;
  onRemoveRoleOpening: (id: string) => void;
  onAddSocialLink: () => void;
  onRemoveSocialLink: (id: string) => void;
  onUploadMedia: (files: FileList | null) => void;
  onCreatePost: () => void;
};

export default function ScanlationFeedComposerModal({
  open, tab, composerTypeLabel, recruitmentForm, showcaseForm, mediaItems, uploading,
  weekDayOptions, recruitmentRoles, socialPlatforms,
  recruitmentRoleByValue, socialPlatformByValue, prefersReducedMotion,
  setOpen, setRecruitmentForm, setShowcaseForm,
  onPaidWorkToggle, onRequirementPortfolioChange, onRequirementExperienceChange,
  onRequirementAvailabilityChange, onRequirementContactChange,
  onToggleRequirementAvailabilityDay, onAddRoleOpening, onRemoveRoleOpening,
  onAddSocialLink, onRemoveSocialLink, onUploadMedia, onCreatePost,
}: Props) {
  const { t } = useI18n();

  return (
    <FeedModal
      title={t('feed.actions.createPost', { type: composerTypeLabel.toLowerCase() })}
      open={open}
      onClose={() => setOpen(false)}
      icon={tab === 'recruitment' ? Send : Send}
      wide
    >
      <div className="flex flex-col gap-4 p-5">
        <ScanlationFeedComposerBasicSection
          tab={tab}
          recruitmentForm={recruitmentForm}
          showcaseForm={showcaseForm}
          setRecruitmentForm={setRecruitmentForm}
          setShowcaseForm={setShowcaseForm}
        />

        {tab === 'recruitment' && (
          <>
            <ScanlationFeedComposerRecruitmentSection
              recruitmentForm={recruitmentForm}
              weekDayOptions={weekDayOptions}
              prefersReducedMotion={prefersReducedMotion}
              setRecruitmentForm={setRecruitmentForm}
              onPaidWorkToggle={onPaidWorkToggle}
              onRequirementPortfolioChange={onRequirementPortfolioChange}
              onRequirementExperienceChange={onRequirementExperienceChange}
              onRequirementAvailabilityChange={onRequirementAvailabilityChange}
              onRequirementContactChange={onRequirementContactChange}
              onToggleRequirementAvailabilityDay={onToggleRequirementAvailabilityDay}
            />
            <ScanlationFeedComposerRolesSection
              recruitmentForm={recruitmentForm}
              recruitmentRoles={recruitmentRoles}
              recruitmentRoleByValue={recruitmentRoleByValue}
              prefersReducedMotion={prefersReducedMotion}
              setRecruitmentForm={setRecruitmentForm}
              onAddRoleOpening={onAddRoleOpening}
              onRemoveRoleOpening={onRemoveRoleOpening}
            />
            <ScanlationFeedComposerSocialSection
              recruitmentForm={recruitmentForm}
              socialPlatforms={socialPlatforms}
              socialPlatformByValue={socialPlatformByValue}
              prefersReducedMotion={prefersReducedMotion}
              setRecruitmentForm={setRecruitmentForm}
              onAddSocialLink={onAddSocialLink}
              onRemoveSocialLink={onRemoveSocialLink}
            />
          </>
        )}

        <ScanlationFeedComposerMediaSection
          mediaItems={mediaItems}
          uploading={uploading}
          onUploadMedia={onUploadMedia}
        />
      </div>

      <div className="flex justify-end gap-2 border-t border-paper/10 px-5 py-4">
        <button type="button" className={feedBtn.ghost} onClick={() => setOpen(false)}>
          {t('common.cancel')}
        </button>
        <button type="button" className={feedBtn.primary} onClick={onCreatePost}>
          <Send size={14} /> {t('feed.actions.publishPost', { type: composerTypeLabel })}
          <span aria-hidden className="font-accent text-[13px] normal-case italic tracking-normal opacity-70">
            公開
          </span>
        </button>
      </div>
    </FeedModal>
  );
}
