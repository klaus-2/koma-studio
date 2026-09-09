import type { Dispatch, SetStateAction } from 'react';
import { Megaphone, Send, Users } from 'lucide-react';

import { useI18n } from '../../i18n';
import type { FeedPostMediaItem } from '../../services/scanlationFeed';
import ScanlationFeedComposerBasicSection from './ScanlationFeedComposerBasicSection';
import ScanlationFeedComposerMediaSection from './ScanlationFeedComposerMediaSection';
import ScanlationFeedComposerRecruitmentSection from './ScanlationFeedComposerRecruitmentSection';
import ScanlationFeedComposerRolesSection from './ScanlationFeedComposerRolesSection';
import ScanlationFeedComposerSocialSection from './ScanlationFeedComposerSocialSection';
import { FeedModal } from './ScanlationFeedPrimitives';
import type {
  ContactPlatformKey,
  ContactPlatformMeta,
  FeedTab,
  RecruitmentFormState,
  RecruitmentRoleOption,
  RecruitmentRoleValue,
  ShowcaseFormState,
  SocialPlatformOption,
} from './ScanlationFeed.types';

type ScanlationFeedComposerModalProps = {
  open: boolean;
  tab: FeedTab;
  composerTypeLabel: string;
  recruitmentForm: RecruitmentFormState;
  showcaseForm: ShowcaseFormState;
  mediaItems: FeedPostMediaItem[];
  uploading: boolean;
  weekDayOptions: readonly string[];
  recruitmentRoles: readonly RecruitmentRoleOption[];
  socialPlatforms: readonly SocialPlatformOption[];
  contactPlatformMeta: ContactPlatformMeta;
  recruitmentRoleByValue: ReadonlyMap<
    RecruitmentRoleValue,
    RecruitmentRoleOption
  >;
  socialPlatformByValue: ReadonlyMap<ContactPlatformKey, SocialPlatformOption>;
  prefersReducedMotion: boolean;
  setOpen: (open: boolean) => void;
  setRecruitmentForm: Dispatch<SetStateAction<RecruitmentFormState>>;
  setShowcaseForm: Dispatch<SetStateAction<ShowcaseFormState>>;
  onPaidWorkToggle: (value: boolean) => void;
  onRequirementPortfolioChange: (value: boolean) => void;
  onRequirementExperienceChange: (value: boolean) => void;
  onRequirementAvailabilityChange: (value: boolean) => void;
  onRequirementContactChange: (value: boolean) => void;
  onToggleRequirementAvailabilityDay: (day: string) => void;
  onAddRoleOpening: () => void;
  onRemoveRoleOpening: (id: string) => void;
  onAddSocialLink: () => void;
  onRemoveSocialLink: (id: string) => void;
  onUploadMedia: (files: FileList | null) => void;
  onCreatePost: () => void;
};

export default function ScanlationFeedComposerModal({
  open,
  tab,
  composerTypeLabel,
  recruitmentForm,
  showcaseForm,
  mediaItems,
  uploading,
  weekDayOptions,
  recruitmentRoles,
  socialPlatforms,
  contactPlatformMeta,
  recruitmentRoleByValue,
  socialPlatformByValue,
  prefersReducedMotion,
  setOpen,
  setRecruitmentForm,
  setShowcaseForm,
  onPaidWorkToggle,
  onRequirementPortfolioChange,
  onRequirementExperienceChange,
  onRequirementAvailabilityChange,
  onRequirementContactChange,
  onToggleRequirementAvailabilityDay,
  onAddRoleOpening,
  onRemoveRoleOpening,
  onAddSocialLink,
  onRemoveSocialLink,
  onUploadMedia,
  onCreatePost,
}: ScanlationFeedComposerModalProps) {
  const { t } = useI18n();

  return (
    <FeedModal
      title={t('feed.actions.createPost', {
        type: composerTypeLabel.toLowerCase(),
      })}
      open={open}
      onClose={() => setOpen(false)}
      icon={tab === 'recruitment' ? Users : Megaphone}
      wide
    >
      <div className="koma-feed-modal-body">
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
              contactPlatformMeta={contactPlatformMeta}
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

      <div className="koma-feed-modal-footer">
        <button
          type="button"
          className="koma-feed-btn koma-feed-btn--ghost"
          onClick={() => setOpen(false)}
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          className="koma-feed-btn koma-feed-btn--primary"
          onClick={onCreatePost}
        >
          <Send size={14} />{' '}
          {t('feed.actions.publishPost', { type: composerTypeLabel })}
        </button>
      </div>
    </FeedModal>
  );
}
