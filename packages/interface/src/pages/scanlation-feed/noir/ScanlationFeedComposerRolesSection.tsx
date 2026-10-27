'use client';

import type { Dispatch, SetStateAction } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { Briefcase, Check, DollarSign, Plus, X } from 'lucide-react';

import { useI18n } from '../../../i18n';
import {
  ComposerSection, FeedField, FeedInput, FeedSelect, feedBtn,
} from './ScanlationFeedPrimitives';
import type {
  RecruitmentFormState, RecruitmentRoleOption, RecruitmentRoleValue,
} from '../ScanlationFeed.types';

type Props = {
  recruitmentForm: RecruitmentFormState;
  recruitmentRoles: readonly RecruitmentRoleOption[];
  recruitmentRoleByValue: ReadonlyMap<RecruitmentRoleValue, RecruitmentRoleOption>;
  prefersReducedMotion: boolean;
  setRecruitmentForm: Dispatch<SetStateAction<RecruitmentFormState>>;
  onAddRoleOpening: () => void;
  onRemoveRoleOpening: (id: string) => void;
};

export default function ScanlationFeedComposerRolesSection({
  recruitmentForm, recruitmentRoles, recruitmentRoleByValue,
  prefersReducedMotion, setRecruitmentForm, onAddRoleOpening, onRemoveRoleOpening,
}: Props) {
  const { t } = useI18n();
  const allAdded = recruitmentForm.roleOpenings.length >= recruitmentRoles.length;

  return (
    <ComposerSection
      icon={Briefcase}
      label={t('feed.composer.sections.roles')}
      sub={t('feed.composer.sections.rolesSub')}
    >
      <AnimatePresence>
        {recruitmentForm.roleOpenings.length > 0 && (
          <div className="flex flex-col gap-2">
            {recruitmentForm.roleOpenings.map((entry, idx) => {
              const meta = recruitmentRoleByValue.get(entry.role);
              return (
                <m.div
                  key={entry.id}
                  layout
                  initial={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: idx * 0.04 }}
                  className="panel-cut-sm flex items-center gap-3 border border-paper/12 border-l-[3px] border-l-crimson bg-ink-2/60 px-3 py-2.5"
                >
                  <span className="panel-cut-sm grid h-8 w-8 flex-none place-items-center border border-crimson/40 bg-crimson/10 text-crimson">
                    <Briefcase size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-display text-[12px] font-extrabold uppercase tracking-wide text-paper">
                        {meta?.label ?? entry.role}
                      </span>
                      {meta?.shortName && (
                        <span className="panel-cut-sm flex-none border border-gold/40 bg-gold/10 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-gold">
                          {meta.shortName}
                        </span>
                      )}
                    </div>
                    {recruitmentForm.paidWork && entry.compensationAmount && (
                      <span className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-gold">
                        <DollarSign size={10} /> R$ {Number(entry.compensationAmount).toFixed(2)}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="noir-icon-btn"
                    onClick={() => onRemoveRoleOpening(entry.id)}
                    aria-label={t('common.removeValue', { value: meta?.label ?? entry.role })}
                  >
                    <X size={12} />
                  </button>
                </m.div>
              );
            })}
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {recruitmentForm.showRoleInput && (
          <m.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="halftone panel-cut-sm flex flex-col gap-3 border border-paper/10 bg-ink/50 p-3.5">
              <div className="flex flex-wrap gap-3">
                <FeedField label={t('feed.composer.roles.roleLabel')}>
                  <FeedSelect
                    value={recruitmentForm.pendingRole}
                    onChange={(e) =>
                      setRecruitmentForm((c) => ({
                        ...c,
                        pendingRole: e.target.value as RecruitmentRoleValue,
                        roleError: '',
                      }))
                    }
                  >
                    {recruitmentRoles.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </FeedSelect>
                </FeedField>
                {recruitmentForm.paidWork && (
                  <FeedField
                    label={t('feed.composer.roles.valueLabel')}
                    hint={t('feed.composer.roles.valueHint')}
                  >
                    <FeedInput
                      type="number" min="0" step="0.01"
                      placeholder={t('feed.composer.roles.valuePlaceholder')}
                      value={recruitmentForm.pendingCompensationAmount}
                      onChange={(e) =>
                        setRecruitmentForm((c) => ({
                          ...c,
                          pendingCompensationAmount: e.target.value,
                          roleError: '',
                        }))
                      }
                    />
                  </FeedField>
                )}
              </div>
              {recruitmentForm.roleError && (
                <p role="alert" className="font-mono text-[10px] text-crimson">
                  {recruitmentForm.roleError}
                </p>
              )}
              <div className="flex gap-2">
                <button type="button" className={`${feedBtn.confirm} ${feedBtn.sm}`} onClick={onAddRoleOpening}>
                  <Check size={12} /> {t('feed.composer.roles.add')}
                </button>
                <button
                  type="button"
                  className={`${feedBtn.ghost} ${feedBtn.sm}`}
                  onClick={() =>
                    setRecruitmentForm((c) => ({
                      ...c,
                      showRoleInput: false,
                      pendingRole: 'RAW',
                      pendingCompensationAmount: '',
                      roleError: '',
                    }))
                  }
                >
                  <X size={12} /> {t('common.cancel')}
                </button>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {!recruitmentForm.showRoleInput && (
        <button
          type="button"
          disabled={allAdded}
          onClick={() =>
            setRecruitmentForm((c) => ({ ...c, showRoleInput: true, roleError: '' }))
          }
          className="panel-cut-sm flex items-center justify-center gap-2 border border-dashed border-paper/20 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-paper/45 transition-all duration-150 hover:border-crimson/50 hover:text-crimson disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={13} />
          {allAdded ? t('feed.composer.roles.allAdded') : t('feed.composer.roles.addBtn')}
        </button>
      )}
    </ComposerSection>
  );
}
