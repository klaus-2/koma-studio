import type { Dispatch, SetStateAction } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Globe, Plus, X } from 'lucide-react';

import { useI18n } from '../../i18n';
import type {
  ContactPlatformKey,
  ContactPlatformMeta,
  RecruitmentFormState,
  SocialPlatformOption,
} from './ScanlationFeed.types';

type ScanlationFeedComposerSocialSectionProps = {
  recruitmentForm: RecruitmentFormState;
  contactPlatformMeta: ContactPlatformMeta;
  socialPlatforms: readonly SocialPlatformOption[];
  socialPlatformByValue: ReadonlyMap<ContactPlatformKey, SocialPlatformOption>;
  prefersReducedMotion: boolean;
  setRecruitmentForm: Dispatch<SetStateAction<RecruitmentFormState>>;
  onAddSocialLink: () => void;
  onRemoveSocialLink: (id: string) => void;
};

export default function ScanlationFeedComposerSocialSection({
  recruitmentForm,
  contactPlatformMeta,
  socialPlatforms,
  socialPlatformByValue,
  prefersReducedMotion,
  setRecruitmentForm,
  onAddSocialLink,
  onRemoveSocialLink,
}: ScanlationFeedComposerSocialSectionProps) {
  const { t } = useI18n();

  return (
    <div className="koma-feed-csection">
      <div className="koma-feed-csection__head">
        <div className="koma-feed-csection__icon">
          <Globe size={14} />
        </div>
        <div className="koma-feed-csection__label">
          {t('feed.composer.social.title')}{' '}
          <span className="koma-feed-csection__sub">
            {t('feed.composer.social.sub')}
          </span>
        </div>
      </div>
      <AnimatePresence>
        {recruitmentForm.socialLinks.length > 0 && (
          <div className="koma-feed-socials">
            {recruitmentForm.socialLinks.map((item, idx) => {
              const platform = socialPlatformByValue.get(item.platform);
              const Icon = platform?.icon ?? Globe;
              const display =
                platform?.type === 'username' &&
                !/^[a-z][a-z\d+.-]*:\/\//i.test(item.value)
                  ? `@${item.value.replace(/^@/, '')}`
                  : item.value;

              return (
                <motion.div
                  key={item.id}
                  initial={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: idx * 0.04 }}
                  layout
                  className={`koma-feed-social koma-feed-social--${platform?.cssKey ?? 'discord'}`}
                >
                  <div className="koma-feed-social__gradient" />
                  <div className="koma-feed-social__icon">
                    <Icon size={16} />
                  </div>
                  <div className="koma-feed-social__info">
                    <div className="koma-feed-social__platform">
                      {platform?.label ?? item.platform}
                    </div>
                    <div className="koma-feed-social__value">{display}</div>
                  </div>
                  <button
                    type="button"
                    className="koma-feed-social__remove"
                    onClick={() => onRemoveSocialLink(item.id)}
                    aria-label={t('common.removeValue', {
                      value: platform?.label ?? item.platform,
                    })}
                  >
                    <X size={13} />
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {recruitmentForm.showSocialInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="koma-feed-inline"
          >
            <div className="koma-feed-inline__row">
              <div className="koma-feed-field">
                <label className="koma-feed-field__label">
                  {t('feed.composer.social.platform')}
                </label>
                <select
                  className="koma-feed-field__select"
                  value={recruitmentForm.pendingSocialPlatform}
                  onChange={(e) =>
                    setRecruitmentForm((c) => ({
                      ...c,
                      pendingSocialPlatform: e.target.value as ContactPlatformKey,
                      pendingSocialValue: '',
                      socialError: '',
                    }))
                  }
                >
                  {socialPlatforms.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="koma-feed-field">
                <label className="koma-feed-field__label">
                  {socialPlatformByValue.get(recruitmentForm.pendingSocialPlatform)
                    ?.type === 'username'
                    ? t('feed.composer.social.user')
                    : t('feed.composer.social.url')}
                </label>
                <input
                  className="koma-feed-field__input"
                  type={
                    recruitmentForm.pendingSocialPlatform === 'email'
                      ? 'email'
                      : 'text'
                  }
                  value={recruitmentForm.pendingSocialValue}
                  onChange={(e) =>
                    setRecruitmentForm((c) => ({
                      ...c,
                      pendingSocialValue: e.target.value,
                      socialError: '',
                    }))
                  }
                  placeholder={
                    contactPlatformMeta[recruitmentForm.pendingSocialPlatform]
                      .placeholder
                  }
                />
              </div>
            </div>
            {recruitmentForm.socialError && (
              <div className="koma-feed-inline__error" role="alert">
                {recruitmentForm.socialError}
              </div>
            )}
            <div className="koma-feed-inline__actions">
              <button
                type="button"
                className="koma-feed-btn koma-feed-btn--confirm koma-feed-btn--sm"
                onClick={onAddSocialLink}
              >
                <Check size={13} /> {t('feed.composer.roles.add')}
              </button>
              <button
                type="button"
                className="koma-feed-btn koma-feed-btn--ghost koma-feed-btn--sm"
                onClick={() =>
                  setRecruitmentForm((c) => ({
                    ...c,
                    showSocialInput: false,
                    pendingSocialPlatform: 'discord',
                    pendingSocialValue: '',
                    socialError: '',
                  }))
                }
              >
                <X size={13} /> {t('common.cancel')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {!recruitmentForm.showSocialInput && (
        <button
          type="button"
          className="koma-feed-add"
          onClick={() =>
            setRecruitmentForm((c) => ({
              ...c,
              showSocialInput: true,
              socialError: '',
            }))
          }
          disabled={recruitmentForm.socialLinks.length >= socialPlatforms.length}
        >
          <div className="koma-feed-add__icon">
            <Plus size={14} />
          </div>
          {recruitmentForm.socialLinks.length >= socialPlatforms.length
            ? t('feed.composer.social.allAdded')
            : t('feed.composer.social.addBtn')}
        </button>
      )}
    </div>
  );
}
