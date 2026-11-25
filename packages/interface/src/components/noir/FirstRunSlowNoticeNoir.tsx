import type { JSX, KeyboardEvent } from 'react';
import { m } from 'framer-motion';
import { Hourglass, X } from 'lucide-react';
import { useI18n } from '../../i18n';
import { btnPrimary } from '../system/v2/kit';
import DontShowAgainCheckbox from '../DontShowAgainCheckbox';
import type { FirstRunNoticeController } from '../FirstRunSlowNotice';

export default function FirstRunSlowNoticeNoir({
  controller,
}: {
  controller: FirstRunNoticeController;
}): JSX.Element {
  const { t } = useI18n();
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') controller.dismiss();
  };
  return (
    <m.div
      initial={{ opacity: 0, y: 24, x: -8 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{ type: 'spring', stiffness: 340, damping: 28 }}
      className="glass panel-cut fixed bottom-14 left-5 z-[125] w-[min(360px,calc(100vw-2rem))] border border-paper/10 p-4"
      role="status"
      aria-live="polite"
      aria-labelledby="first-run-notice-title-noir"
      aria-describedby="first-run-notice-desc-noir"
      onKeyDown={onKeyDown}
    >
      <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-gold" />
      <button
        type="button"
        onClick={controller.dismiss}
        aria-label={t('firstRunNotice.closeAria')}
        className="absolute right-2 top-2 p-1 text-paper/35 transition-colors hover:text-crimson focus-visible:outline focus-visible:outline-2 focus-visible:outline-crimson"
      >
        <X size={12} aria-hidden />
      </button>

      <div className="flex items-start gap-3 pr-5">
        <span
          aria-hidden
          className="panel-cut-sm flex h-9 w-9 shrink-0 items-center justify-center border border-gold bg-gold/10 text-gold"
        >
          <Hourglass size={15} />
        </span>
        <div className="min-w-0">
          <p className="kicker !text-[9px]">{t('firstRunNotice.kicker')}</p>
          <h3
            id="first-run-notice-title-noir"
            className="font-display text-sm font-black uppercase tracking-tight text-paper"
          >
            {t('firstRunNotice.title')}
          </h3>
          <p id="first-run-notice-desc-noir" className="mt-1 font-mono text-[10px] leading-relaxed text-paper/60">
            {t('firstRunNotice.body')}
          </p>
          <p className="mt-1 font-mono text-[10px] leading-relaxed text-paper/60">
            {t('firstRunNotice.followUp')}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-paper/8 pt-3">
        <DontShowAgainCheckbox
          checked={controller.dontShowAgain}
          onChange={controller.setDontShowAgain}
        />
        <button type="button" onClick={controller.dismiss} className={btnPrimary}>
          {t('firstRunNotice.dismiss')}
        </button>
      </div>
    </m.div>
  );
}
