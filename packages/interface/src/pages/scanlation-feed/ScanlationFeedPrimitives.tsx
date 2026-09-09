import { memo, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Flag, X, type LucideIcon } from 'lucide-react';

import { useI18n } from '../../i18n';

export const FeedModal = ({
  title,
  open,
  onClose,
  icon: Icon = Flag,
  wide = false,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  icon?: LucideIcon;
  wide?: boolean;
  children: ReactNode;
}) => {
  const { t } = useI18n();
  if (!open) return null;
  return (
    <div
      className="koma-feed-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="koma-feed-modal-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`koma-feed-modal-panel${wide ? ' koma-feed-modal-panel--lg' : ''}`}
      >
        <div className="koma-feed-modal-header">
          <div className="koma-feed-modal-header__icon">
            <Icon size={16} />
          </div>
          <div className="koma-feed-modal-header__title">{title}</div>
          <button
            type="button"
            className="koma-feed-iconbtn"
            onClick={onClose}
            aria-label={t('feed.modal.closeAria')}
          >
            <X size={15} />
          </button>
        </div>
        <div className="koma-feed-modal-scroll">{children}</div>
      </div>
    </div>
  );
};

export const ToggleSwitch = memo(function ToggleSwitch({
  checked,
  onChange,
  label,
  description,
  icon: Icon,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  icon: LucideIcon;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`koma-feed-toggle${checked ? ' koma-feed-toggle--active' : ''}`}
    >
      <div className="koma-feed-toggle__icon-wrap">
        <Icon size={17} />
      </div>
      <div className="koma-feed-toggle__body">
        <div className="koma-feed-toggle__title">{label}</div>
        {description && (
          <div className="koma-feed-toggle__desc">{description}</div>
        )}
      </div>
      <div className="koma-feed-toggle__track">
        <motion.div
          className="koma-feed-toggle__thumb"
          animate={{ x: checked ? 20 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </div>
    </button>
  );
});

export const RequirementChip = memo(function RequirementChip({
  checked,
  onChange,
  label,
  icon: Icon,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  icon: LucideIcon;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`koma-feed-req${checked ? ' koma-feed-req--active' : ''}`}
    >
      <Icon size={14} />
      <span>{label}</span>
      {checked && <CheckCircle2 size={13} className="koma-feed-req__check" />}
    </button>
  );
});
