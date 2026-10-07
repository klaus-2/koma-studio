'use client';

import type { Dispatch, SetStateAction } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Globe, Plus, X, type LucideIcon } from 'lucide-react';

import { useI18n } from '../../../i18n';
import {
  ComposerSection, FeedField, FeedInput, FeedSelect, feedBtn,
} from './ScanlationFeedPrimitives';
import type {
  ContactPlatformKey, RecruitmentFormState, SocialPlatformOption,
} from '../ScanlationFeed.types';

type Props = {
  recruitmentForm: RecruitmentFormState;
  socialPlatforms: readonly SocialPlatformOption[];
  socialPlatformByValue: ReadonlyMap<ContactPlatformKey, SocialPlatformOption>;
  prefersReducedMotion: boolean;
  setRecruitmentForm: Dispatch<SetStateAction<RecruitmentFormState>>;
  onAddSocialLink: () => void;
  onRemoveSocialLink: (id: string) => void;
};

export default function ScanlationFeedComposerSocialSection({
  recruitmentForm, socialPlatforms, socialPlatformByValue,
  prefersReducedMotion, setRecruitmentForm, onAddSocialLink, onRemoveSocialLink,
}: Props) {
  const { t } = useI18n();
  const allAdded = recruitmentForm.socialLinks.length >= socialPlatforms.length;

  return (
    <ComposerSection
      icon={Globe}
      label={t('feed.composer.social.title')}
      sub={t('feed.composer.social.sub')}
    >
      {/* Fichas de contato */}
      <AnimatePresence>
        {recruitmentForm.socialLinks.length > 0 && (
          <div className="flex flex-col gap-2">
            {recruitmentForm.socialLinks.map((item, idx) => {
              const p = socialPlatformByValue.get(item.platform);
              const PIcon: LucideIcon = p?.icon ?? Globe;
              const display =
                p?.type === 'username' && !/^[a-z][a-z\d+.-]*:\/\//i.test(item.value)
                  ? `@${item.value.replace(/^@/, '')}`
                  : item.value;
              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: idx * 0.04 }}
                  className="panel-cut-sm flex items-center gap-3 border border-paper/12 border-l-[3px] border-l-azure bg-ink-2/60 px-3 py-2.5"
                >
                  <span className="panel-cut-sm grid h-8 w-8 flex-none place-items-center border border-azure/40 bg-azure/10 text-azure">
                    <PIcon size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display text-[12px] font-extrabold uppercase tracking-wide text-paper">
                      {p?.label ?? item.platform}
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[10px] text-paper/50">
                      {display}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="noir-icon-btn"
                    onClick={() => onRemoveSocialLink(item.id)}
                    aria-label={t('common.removeValue', { value: p?.label ?? item.platform })}
                  >
                    <X size={12} />
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </AnimatePresence>

      {/* Inline form */}
      <AnimatePresence>
        {recruitmentForm.showSocialInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="halftone panel-cut-sm flex flex-col gap-3 border border-paper/10 bg-ink/50 p-3.5">
              <div className="flex flex-wrap gap-3">
                <FeedField label={t('feed.composer.social.platform')}>
                  <FeedSelect
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
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </FeedSelect>
                </FeedField>
                <FeedField
                  label={
                    socialPlatformByValue.get(recruitmentForm.pendingSocialPlatform)?.type === 'username'
                      ? t('feed.composer.social.user')
                      : t('feed.composer.social.url')
                  }
                >
                  <FeedInput
                    type={recruitmentForm.pendingSocialPlatform === 'email' ? 'email' : 'text'}
                    value={recruitmentForm.pendingSocialValue}
                    onChange={(e) =>
                      setRecruitmentForm((c) => ({
                        ...c,
                        pendingSocialValue: e.target.value,
                        socialError: '',
                      }))
                    }
                    placeholder={
                      socialPlatformByValue.get(recruitmentForm.pendingSocialPlatform)?.label
                    }
                  />
                </FeedField>
              </div>
              {recruitmentForm.socialError && (
                <p role="alert" className="font-mono text-[10px] text-crimson">
                  {recruitmentForm.socialError}
                </p>
              )}
              <div className="flex gap-2">
                <button type="button" className={`${feedBtn.confirm} ${feedBtn.sm}`} onClick={onAddSocialLink}>
                  <Check size={12} /> {t('feed.composer.roles.add')}
                </button>
                <button
                  type="button"
                  className={`${feedBtn.ghost} ${feedBtn.sm}`}
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
                  <X size={12} /> {t('common.cancel')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add button — dashed slot */}
      {!recruitmentForm.showSocialInput && (
        <button
          type="button"
          disabled={allAdded}
          onClick={() =>
            setRecruitmentForm((c) => ({ ...c, showSocialInput: true, socialError: '' }))
          }
          className="panel-cut-sm flex items-center justify-center gap-2 border border-dashed border-paper/20 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-paper/45 transition-all duration-150 hover:border-azure/50 hover:text-azure disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={13} />
          {allAdded ? t('feed.composer.social.allAdded') : t('feed.composer.social.addBtn')}
        </button>
      )}
    </ComposerSection>
  );
}
