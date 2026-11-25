import type { JSX, KeyboardEvent } from 'react';
import { Hourglass, X } from 'lucide-react';
import { useI18n } from '../i18n';
import DontShowAgainCheckbox from './DontShowAgainCheckbox';
import type { FirstRunNoticeController } from './FirstRunSlowNotice.types';

export default function FirstRunSlowNoticeClassic({
  controller,
}: {
  controller: FirstRunNoticeController;
}): JSX.Element {
  const { t } = useI18n();
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') controller.dismiss();
  };
  return (
    <div
      className="koma-toast koma-toast--start"
      role="status"
      aria-live="polite"
      aria-labelledby="first-run-notice-title"
      aria-describedby="first-run-notice-desc"
      onKeyDown={onKeyDown}
    >
      <div className="koma-toast__glow" aria-hidden="true" />
      <button
        type="button"
        onClick={controller.dismiss}
        className="koma-toast__close"
        aria-label={t('firstRunNotice.closeAria')}
      >
        <X size={12} aria-hidden="true" />
      </button>
      <div className="koma-toast__icon" aria-hidden="true">
        <Hourglass size={18} />
      </div>
      <div className="koma-toast__body">
        <h3 id="first-run-notice-title" className="koma-toast__title">
          {t('firstRunNotice.title')}
        </h3>
        <p id="first-run-notice-desc" className="koma-toast__desc">
          {t('firstRunNotice.body')}
        </p>
        <p className="koma-toast__desc">{t('firstRunNotice.followUp')}</p>
      </div>
      <div className="koma-toast__actions koma-toast__actions--split">
        <DontShowAgainCheckbox
          checked={controller.dontShowAgain}
          onChange={controller.setDontShowAgain}
          className="koma-toast__desc"
        />
        <button
          type="button"
          onClick={controller.dismiss}
          className="koma-toast__btn koma-toast__btn--primary"
        >
          {t('firstRunNotice.dismiss')}
        </button>
      </div>
    </div>
  );
}
