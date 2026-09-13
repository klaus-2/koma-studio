import type { Dispatch, SetStateAction } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import {
  Briefcase,
  Check,
  DollarSign,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';

import { useI18n } from '../../i18n';
import type {
  RecruitmentFormState,
  RecruitmentRoleOption,
  RecruitmentRoleValue,
} from './ScanlationFeed.types';

type ScanlationFeedComposerRolesSectionProps = {
  recruitmentForm: RecruitmentFormState;
  recruitmentRoles: readonly RecruitmentRoleOption[];
  recruitmentRoleByValue: ReadonlyMap<
    RecruitmentRoleValue,
    RecruitmentRoleOption
  >;
  prefersReducedMotion: boolean;
  setRecruitmentForm: Dispatch<SetStateAction<RecruitmentFormState>>;
  onAddRoleOpening: () => void;
  onRemoveRoleOpening: (id: string) => void;
};

export default function ScanlationFeedComposerRolesSection({
  recruitmentForm,
  recruitmentRoles,
  recruitmentRoleByValue,
  prefersReducedMotion,
  setRecruitmentForm,
  onAddRoleOpening,
  onRemoveRoleOpening,
}: ScanlationFeedComposerRolesSectionProps) {
  const { t } = useI18n();

  return (
    <div className="koma-feed-csection">
      <div className="koma-feed-csection__head">
        <div className="koma-feed-csection__icon">
          <Briefcase size={14} />
        </div>
        <div className="koma-feed-csection__label">
          {t('feed.composer.sections.roles')}{' '}
          <span className="koma-feed-csection__sub">
            {t('feed.composer.sections.rolesSub')}
          </span>
        </div>
      </div>
      <AnimatePresence>
        {recruitmentForm.roleOpenings.length > 0 && (
          <div className="koma-feed-roles">
            {recruitmentForm.roleOpenings.map((entry, idx) => {
              const meta = recruitmentRoleByValue.get(entry.role);
              return (
                <m.div
                  key={entry.id}
                  initial={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: idx * 0.04 }}
                  layout
                  className={`koma-feed-role koma-feed-role--${meta?.cssKey ?? 'raw'}`}
                >
                  <div className="koma-feed-role__gradient" />
                  <div className="koma-feed-role__icon">
                    <Briefcase size={16} />
                  </div>
                  <div className="koma-feed-role__info">
                    <div className="koma-feed-role__name">
                      {meta?.label ?? entry.role}
                      {meta?.shortName && (
                        <span className="koma-feed-role__short">
                          {meta.shortName}
                        </span>
                      )}
                      <Sparkles size={10} style={{ color: '#facc15' }} />
                    </div>
                    {recruitmentForm.paidWork && entry.compensationAmount && (
                      <div className="koma-feed-role__pay">
                        <DollarSign size={11} /> R${' '}
                        {Number(entry.compensationAmount).toFixed(2)}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="koma-feed-role__remove"
                    onClick={() => onRemoveRoleOpening(entry.id)}
                    aria-label={t('common.removeValue', {
                      value: meta?.label ?? entry.role,
                    })}
                  >
                    <X size={13} />
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
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="koma-feed-inline"
          >
            <div className="koma-feed-inline__row">
              <div className="koma-feed-field">
                <label className="koma-feed-field__label">
                  {t('feed.composer.roles.roleLabel')}
                </label>
                <select
                  className="koma-feed-field__select"
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
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              {recruitmentForm.paidWork && (
                <div className="koma-feed-field">
                  <label className="koma-feed-field__label">
                    {t('feed.composer.roles.valueLabel')}{' '}
                    <span className="koma-feed-field__label-hint">
                      {t('feed.composer.roles.valueHint')}
                    </span>
                  </label>
                  <input
                    className="koma-feed-field__input"
                    type="number"
                    min="0"
                    step="0.01"
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
                </div>
              )}
            </div>
            {recruitmentForm.roleError && (
              <div className="koma-feed-inline__error" role="alert">
                {recruitmentForm.roleError}
              </div>
            )}
            <div className="koma-feed-inline__actions">
              <button
                type="button"
                className="koma-feed-btn koma-feed-btn--confirm koma-feed-btn--sm"
                onClick={onAddRoleOpening}
              >
                <Check size={13} /> {t('feed.composer.roles.add')}
              </button>
              <button
                type="button"
                className="koma-feed-btn koma-feed-btn--ghost koma-feed-btn--sm"
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
                <X size={13} /> {t('common.cancel')}
              </button>
            </div>
          </m.div>
        )}
      </AnimatePresence>
      {!recruitmentForm.showRoleInput && (
        <button
          type="button"
          className="koma-feed-add"
          onClick={() =>
            setRecruitmentForm((c) => ({
              ...c,
              showRoleInput: true,
              roleError: '',
            }))
          }
          disabled={recruitmentForm.roleOpenings.length >= recruitmentRoles.length}
        >
          <div className="koma-feed-add__icon">
            <Plus size={14} />
          </div>
          {recruitmentForm.roleOpenings.length >= recruitmentRoles.length
            ? t('feed.composer.roles.allAdded')
            : t('feed.composer.roles.addBtn')}
        </button>
      )}
    </div>
  );
}
