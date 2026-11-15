import type { JSX } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, ChevronUp, Info, X } from 'lucide-react';

import { useI18n } from '../../i18n';
import type { StatusMessageTone } from '../../types/dashboard.types';

const STATUS_PREVIEW_LIMIT = 110;

const buildStatusPreview = (message: string): string => {
  if (message.length <= STATUS_PREVIEW_LIMIT) return message;
  const cut = message.slice(0, STATUS_PREVIEW_LIMIT);
  const sentenceEnd = Math.max(
    cut.lastIndexOf('. '),
    cut.lastIndexOf('! '),
    cut.lastIndexOf('? '),
  );
  if (sentenceEnd > 40) return message.slice(0, sentenceEnd + 1);
  return `${cut.trimEnd()}…`;
};

const ToneIcon = ({ tone }: { tone: StatusMessageTone }): JSX.Element => {
  if (tone === 'error') return <AlertTriangle size={15} />;
  if (tone === 'success') return <CheckCircle2 size={15} />;
  if (tone === 'warning') return <AlertTriangle size={15} />;
  return <Info size={15} />;
};

interface FooterStatusMessageProps {
  readonly message: string;
  readonly tone: StatusMessageTone;
  readonly textClassName: string;
}

export function FooterStatusMessage({
  message,
  tone,
  textClassName,
}: FooterStatusMessageProps): JSX.Element {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const [position, setPosition] = useState<{
    left: number;
    width: number;
    bottom: number;
  } | null>(null);

  useEffect(() => {
    setOpen(false);
  }, [message]);

  useLayoutEffect(() => {
    if (!open) return;
    const update = (): void => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      setPosition({
        left: Math.max(12, rect.left),
        width: Math.min(640, Math.max(360, rect.width + 160)),
        bottom: window.innerHeight - rect.top + 10,
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  const preview = buildStatusPreview(message);
  const hasMore = message.length > preview.length;

  const popStyle: Record<string, string | number> =
    position !== null
      ? { left: position.left, width: position.width, bottom: position.bottom }
      : { left: 12, bottom: 48, width: 'min(560px, 92vw)' };

  return (
    <>
      <span
        ref={anchorRef}
        role={tone === 'error' ? 'alert' : 'status'}
        className={textClassName}
      >
        {preview}
      </span>
      {hasMore && (
        <button
          type="button"
          className={`koma-status-details-btn${open ? ' koma-status-details-btn--open' : ''}`}
          aria-label={t('dashboard.footer.details.button')}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <ChevronUp size={12} />
        </button>
      )}
      {open &&
        createPortal(
          <div
            className="koma-status-details"
            role="dialog"
            aria-label={t('dashboard.footer.details.title')}
            style={popStyle}
          >
            <div className="koma-status-details__head">
              <span
                className={`koma-status-details__tone koma-status-details__tone--${tone}`}
              >
                <ToneIcon tone={tone} />
                {t('dashboard.footer.details.title')}
              </span>
              <button
                type="button"
                className="koma-status-details__close"
                aria-label={t('dashboard.footer.details.close')}
                onClick={() => setOpen(false)}
              >
                <X size={13} />
              </button>
            </div>
            <p className="koma-status-details__body">{message}</p>
          </div>,
          document.body,
        )}
    </>
  );
}
