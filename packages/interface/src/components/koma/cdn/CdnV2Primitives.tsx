'use client';

import type { ReactNode } from 'react';
import {
  motion,
  useReducedMotion,
} from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import {
  ArchiveX,
  Check,
  Loader2,
} from 'lucide-react';

export const KOMA_EASE = [
  0.22,
  1,
  0.36,
  1,
] as const;

export const CDN_IMAGE_ACCEPT = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
};

export type QueueItemStatus =
  | 'queued'
  | 'processing'
  | 'uploaded'
  | 'error';

export async function copyText(
  value: string,
): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea =
    document.createElement('textarea');

  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.pointerEvents = 'none';
  textarea.style.opacity = '0';

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

export function downloadTextFile(
  fileName: string,
  content: string,
): void {
  const blob = new Blob([content], {
    type: 'text/plain;charset=utf-8',
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

export function formatFileSize(
  bytes: number,
): string {
  if (bytes < 1024) return `${bytes} B`;

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(
    2,
  )} MB`;
}

interface EditorialCdnHeroProps {
  index: string;
  eyebrow: string;
  title: string;
  accentWord: string;
  description: string;
  serviceCode: string;
  statusReady: boolean;
  statusText: string;
  accent?: 'crimson' | 'azure';
  children?: ReactNode;
}

export function EditorialCdnHero({
  index,
  eyebrow,
  title,
  accentWord,
  description,
  serviceCode,
  statusReady,
  statusText,
  accent = 'crimson',
  children,
}: EditorialCdnHeroProps) {
  const reduceMotion = useReducedMotion();

  const accentClasses =
    accent === 'azure'
      ? {
        border: 'border-azure/30',
        background: 'bg-azure/10',
        text: 'text-azure',
        line: 'bg-azure',
        dots: 'halftone',
      }
      : {
        border: 'border-crimson/30',
        background: 'bg-crimson/10',
        text: 'text-crimson',
        line: 'bg-crimson',
        dots: 'halftone-red',
      };

  return (
    <motion.header
      initial={
        reduceMotion
          ? false
          : {
            opacity: 0,
            y: 22,
            clipPath: 'inset(0 0 100% 0)',
          }
      }
      animate={{
        opacity: 1,
        y: 0,
        clipPath: 'inset(0 0 0% 0)',
      }}
      transition={{
        duration: reduceMotion ? 0 : 0.68,
        ease: KOMA_EASE,
      }}
      className="glass panel-cut manga-grid-bg relative isolate overflow-hidden px-5 py-6 sm:px-7 sm:py-8"
    >
      <div
        className={[
          accentClasses.dots,
          'pointer-events-none absolute -right-14 -top-20 size-80 opacity-50',
        ].join(' ')}
        aria-hidden="true"
      />

      <span
        className="text-outline pointer-events-none absolute right-10 top-0 font-display text-[7rem] font-black leading-none sm:text-[9rem]"
        aria-hidden="true"
      >
        {index}
      </span>

      <span
        className="v-text pointer-events-none absolute right-4 top-5 font-display text-[0.62rem] font-black tracking-[0.35em] text-paper/14"
        aria-hidden="true"
      >
        配信・出版・画像保管
      </span>

      <div
        className={[
          'pointer-events-none absolute bottom-0 left-0 h-[3px] w-2/5',
          accentClasses.line,
        ].join(' ')}
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col gap-7 pr-8 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span
              className={[
                'stamp',
                accent === 'azure'
                  ? '!border-azure/55 !bg-azure/10 !text-azure'
                  : '',
              ].join(' ')}
            >
              <span
                className={[
                  'size-1.5',
                  accent === 'azure'
                    ? 'bg-azure'
                    : 'bg-crimson',
                ].join(' ')}
                aria-hidden="true"
              />
              {serviceCode}
            </span>

            <span className="kicker text-paper/35">
              {eyebrow}
            </span>
          </div>

          <h1 className="max-w-4xl font-display text-3xl font-black uppercase leading-[0.88] tracking-[-0.06em] text-paper sm:text-5xl lg:text-6xl">
            {title}
            <span
              className={[
                'font-accent font-normal italic',
                accentClasses.text,
              ].join(' ')}
            >
              {' '}
              {accentWord}
            </span>
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-paper/48">
            {description}
          </p>

          <div className="mt-5 flex items-center gap-3">
            <span
              className={[
                'relative grid size-3 place-items-center border',
                statusReady
                  ? 'border-mint/50 bg-mint/10'
                  : 'border-gold/50 bg-gold/10',
              ].join(' ')}
              aria-hidden="true"
            >
              <span
                className={[
                  'size-1.5',
                  statusReady
                    ? 'koma-blink bg-mint'
                    : 'bg-gold',
                ].join(' ')}
              />
            </span>

            <span
              className={[
                'font-mono text-[0.66rem] font-bold uppercase tracking-[0.12em]',
                statusReady
                  ? 'text-mint'
                  : 'text-gold',
              ].join(' ')}
              role="status"
            >
              {statusText}
            </span>
          </div>
        </div>

        {children ? (
          <div className="grid grid-cols-2 gap-px overflow-hidden border border-paper/10 bg-paper/10 panel-cut-sm sm:grid-cols-3">
            {children}
          </div>
        ) : null}
      </div>
    </motion.header>
  );
}

interface CdnMetricProps {
  icon: LucideIcon;
  value: ReactNode;
  label: string;
  tone?: 'paper' | 'crimson' | 'azure' | 'mint' | 'gold';
}

export function CdnMetric({
  icon: Icon,
  value,
  label,
  tone = 'paper',
}: CdnMetricProps) {
  const toneClass = {
    paper: 'text-paper',
    crimson: 'text-crimson',
    azure: 'text-azure',
    mint: 'text-mint',
    gold: 'text-gold',
  }[tone];

  return (
    <div className="min-w-28 bg-ink-2/95 p-3 sm:min-w-32">
      <Icon
        size={14}
        className={`mb-2 ${toneClass}`}
        aria-hidden="true"
      />

      <strong
        className={`block truncate font-display text-xl font-black ${toneClass}`}
      >
        {value}
      </strong>

      <span className="font-mono text-[0.56rem] uppercase tracking-[0.12em] text-paper/34">
        {label}
      </span>
    </div>
  );
}

interface EditorialCdnPanelProps {
  index: string;
  icon: LucideIcon;
  kicker: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  sticky?: boolean;
}

export function EditorialCdnPanel({
  index,
  icon: Icon,
  kicker,
  title,
  description,
  action,
  children,
  className = '',
  sticky = false,
}: EditorialCdnPanelProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      initial={
        reduceMotion
          ? false
          : {
            opacity: 0,
            y: 20,
          }
      }
      whileInView={{
        opacity: 1,
        y: 0,
      }}
      viewport={{
        once: true,
        amount: 0.08,
      }}
      transition={{
        duration: reduceMotion ? 0 : 0.52,
        ease: KOMA_EASE,
      }}
      className={[
        'glass panel-cut relative isolate overflow-hidden',
        sticky ? 'xl:sticky xl:top-5' : '',
        className,
      ].join(' ')}
    >
      <span
        className="text-outline pointer-events-none absolute right-5 top-0 z-0 font-display text-[5.5rem] font-black leading-none"
        aria-hidden="true"
      >
        {index}
      </span>

      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-crimson"
        aria-hidden="true"
      />

      <header className="relative z-10 flex flex-col gap-4 border-b border-paper/[0.065] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3">
          <span
            className="grid size-9 shrink-0 place-items-center border border-crimson/30 bg-crimson/10 text-crimson panel-cut-sm"
            aria-hidden="true"
          >
            <Icon size={15} />
          </span>

          <div>
            <span className="kicker block">
              // {kicker}
            </span>

            <h2 className="mt-1 font-display text-lg font-black uppercase tracking-[-0.035em] text-paper">
              {title}
            </h2>

            {description ? (
              <p className="mt-1 max-w-2xl text-xs leading-5 text-paper/40">
                {description}
              </p>
            ) : null}
          </div>
        </div>

        {action ? (
          <div className="relative z-10 shrink-0">
            {action}
          </div>
        ) : null}
      </header>

      <div className="relative z-10">
        {children}
      </div>
    </motion.section>
  );
}

interface WorkspaceNoticeProps {
  tone: 'warning' | 'error' | 'success' | 'info';
  icon: LucideIcon;
  children: ReactNode;
  action?: ReactNode;
}

export function WorkspaceNotice({
  tone,
  icon: Icon,
  children,
  action,
}: WorkspaceNoticeProps) {
  const styles = {
    warning:
      'border-gold/45 bg-gold/[0.055] text-gold',
    error:
      'border-crimson/50 bg-crimson/[0.065] text-crimson',
    success:
      'border-mint/45 bg-mint/[0.055] text-mint',
    info: 'border-azure/45 bg-azure/[0.055] text-azure',
  }[tone];

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: -8,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      exit={{
        opacity: 0,
        y: -8,
      }}
      role={
        tone === 'error' || tone === 'warning'
          ? 'alert'
          : 'status'
      }
      className={[
        'panel-cut-sm flex flex-col gap-3 border-l-2 px-4 py-3 sm:flex-row sm:items-center',
        styles,
      ].join(' ')}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Icon
          size={16}
          className="mt-0.5 shrink-0"
          aria-hidden="true"
        />

        <div className="min-w-0 text-xs leading-5 text-paper/62">
          {children}
        </div>
      </div>

      {action ? (
        <div className="shrink-0">{action}</div>
      ) : null}
    </motion.div>
  );
}

interface KomaSwitchCardProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description?: string;
  icon?: LucideIcon;
  tone?: 'crimson' | 'azure' | 'gold';
}

export function KomaSwitchCard({
  checked,
  onChange,
  title,
  description,
  icon: Icon,
  tone = 'crimson',
}: KomaSwitchCardProps) {
  const activeStyle = {
    crimson:
      'border-crimson/55 bg-crimson/[0.065]',
    azure: 'border-azure/55 bg-azure/[0.065]',
    gold: 'border-gold/55 bg-gold/[0.065]',
  }[tone];

  const iconStyle = {
    crimson: 'text-crimson',
    azure: 'text-azure',
    gold: 'text-gold',
  }[tone];

  return (
    <label
      className={[
        'offset-card panel-cut-sm flex cursor-pointer items-start gap-3 border p-3',
        'focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-crimson',
        checked
          ? activeStyle
          : 'border-paper/10 bg-ink/48',
      ].join(' ')}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(event) =>
          onChange(event.target.checked)
        }
      />

      <span
        className={[
          'relative mt-0.5 h-5 w-9 shrink-0 border panel-cut-sm',
          checked
            ? 'border-crimson bg-crimson'
            : 'border-paper/15 bg-ink',
        ].join(' ')}
        aria-hidden="true"
      >
        <span
          className={[
            'absolute top-[3px] size-3 transition-transform duration-200',
            checked
              ? 'translate-x-[18px] bg-ink'
              : 'translate-x-[3px] bg-paper/55',
          ].join(' ')}
        />
      </span>

      <span className="min-w-0">
        <span className="flex items-center gap-2 font-display text-xs font-black uppercase tracking-[-0.015em] text-paper">
          {Icon ? (
            <Icon
              size={13}
              className={
                checked
                  ? iconStyle
                  : 'text-paper/32'
              }
              aria-hidden="true"
            />
          ) : null}

          {title}
        </span>

        {description ? (
          <span className="mt-1 block text-[0.66rem] leading-4 text-paper/36">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}

export function QueueStatusBadge({
  status,
}: {
  status: QueueItemStatus;
}) {
  const styles = {
    queued:
      'border-paper/15 bg-paper/[0.04] text-paper/45',
    processing:
      'border-gold/50 bg-gold/10 text-gold',
    uploaded:
      'border-mint/50 bg-mint/10 text-mint',
    error:
      'border-crimson/50 bg-crimson/10 text-crimson',
  }[status];

  return (
    <span
      role="status"
      className={[
        'inline-flex items-center gap-1.5 border px-2 py-1',
        'font-mono text-[0.55rem] font-bold uppercase tracking-[0.1em] panel-cut-sm',
        styles,
      ].join(' ')}
    >
      {status === 'processing' ? (
        <Loader2
          size={10}
          className="animate-spin"
          aria-hidden="true"
        />
      ) : status === 'uploaded' ? (
        <Check size={10} aria-hidden="true" />
      ) : (
        <span
          className={[
            'size-1.5',
            status === 'error'
              ? 'bg-crimson'
              : 'bg-current',
          ].join(' ')}
          aria-hidden="true"
        />
      )}

      {status}
    </span>
  );
}

export function EmptyQueue({
  message,
}: {
  message: string;
}) {
  return (
    <div className="halftone grid min-h-64 place-items-center p-6 text-center">
      <div>
        <ArchiveX
          size={36}
          strokeWidth={1.2}
          className="mx-auto text-paper/16"
          aria-hidden="true"
        />

        <p className="mt-4 font-mono text-xs uppercase tracking-[0.12em] text-paper/34">
          {message}
        </p>
      </div>
    </div>
  );
}
