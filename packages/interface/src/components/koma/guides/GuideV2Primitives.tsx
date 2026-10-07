'use client';

import type {
  LucideIcon,
} from 'lucide-react';
import {
  Check,
  FileQuestion,
} from 'lucide-react';
import {
  motion,
  useReducedMotion,
} from 'framer-motion';
import type {
  ReactNode,
} from 'react';

export const GUIDE_EASE = [
  0.22,
  1,
  0.36,
  1,
] as const;

export type GuideTone =
  | 'crimson'
  | 'azure'
  | 'mint'
  | 'gold';

export function getGuideTone(
  accent?: string,
): GuideTone {
  const normalized =
    accent?.toLowerCase() ?? '';

  if (
    normalized.includes('blue') ||
    normalized.includes('cyan') ||
    normalized.includes('azure')
  ) {
    return 'azure';
  }

  if (
    normalized.includes('green') ||
    normalized.includes('emerald') ||
    normalized.includes('mint')
  ) {
    return 'mint';
  }

  if (
    normalized.includes('yellow') ||
    normalized.includes('orange') ||
    normalized.includes('gold')
  ) {
    return 'gold';
  }

  return 'crimson';
}

export const GUIDE_TONE_STYLES = {
  crimson: {
    text: 'text-crimson',
    border: 'border-crimson/40',
    background: 'bg-crimson/10',
    solid: 'bg-crimson',
    shadow:
      'drop-shadow-[5px_5px_0_rgba(255,46,99,0.3)]',
  },
  azure: {
    text: 'text-azure',
    border: 'border-azure/40',
    background: 'bg-azure/10',
    solid: 'bg-azure',
    shadow:
      'drop-shadow-[5px_5px_0_rgba(77,201,255,0.3)]',
  },
  mint: {
    text: 'text-mint',
    border: 'border-mint/40',
    background: 'bg-mint/10',
    solid: 'bg-mint',
    shadow:
      'drop-shadow-[5px_5px_0_rgba(62,242,176,0.25)]',
  },
  gold: {
    text: 'text-gold',
    border: 'border-gold/40',
    background: 'bg-gold/10',
    solid: 'bg-gold',
    shadow:
      'drop-shadow-[5px_5px_0_rgba(255,200,87,0.28)]',
  },
} satisfies Record<
  GuideTone,
  Record<string, string>
>;

interface GuidesEditorialHeroProps {
  index: string;
  kicker: string;
  title: string;
  accentWord: string;
  description: string;
  icon: LucideIcon;
  tone?: GuideTone;
  metrics?: ReactNode;
  action?: ReactNode;
}

export function GuidesEditorialHero({
  index,
  kicker,
  title,
  accentWord,
  description,
  icon: Icon,
  tone = 'crimson',
  metrics,
  action,
}: GuidesEditorialHeroProps) {
  const reduceMotion =
    useReducedMotion();

  const styles =
    GUIDE_TONE_STYLES[tone];

  return (
    <motion.header
      initial={
        reduceMotion
          ? false
          : {
            opacity: 0,
            y: 22,
            clipPath:
              'inset(0 0 100% 0)',
          }
      }
      animate={{
        opacity: 1,
        y: 0,
        clipPath: 'inset(0 0 0% 0)',
      }}
      transition={{
        duration: reduceMotion
          ? 0
          : 0.68,
        ease: GUIDE_EASE,
      }}
      className="glass panel-cut manga-grid-bg relative isolate overflow-hidden p-5 sm:p-7 lg:p-8"
    >
      <div
        className={[
          tone === 'crimson'
            ? 'halftone-red'
            : 'halftone',
          'pointer-events-none absolute -right-16 -top-20 size-80 opacity-45',
        ].join(' ')}
        aria-hidden="true"
      />

      <span
        className="text-outline pointer-events-none absolute right-10 top-0 font-display text-[8rem] font-black leading-none sm:text-[10rem]"
        aria-hidden="true"
      >
        {index}
      </span>

      <span
        className="v-text pointer-events-none absolute right-4 top-5 font-display text-[0.62rem] font-black tracking-[0.36em] text-paper/14"
        aria-hidden="true"
      >
        知識・技術・編集
      </span>

      <div
        className={[
          'pointer-events-none absolute bottom-0 left-0 h-[3px] w-2/5',
          styles.solid,
        ].join(' ')}
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col gap-7 pr-8 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span
              className={[
                'grid size-10 place-items-center border panel-cut-sm',
                styles.border,
                styles.background,
                styles.text,
              ].join(' ')}
              aria-hidden="true"
            >
              <Icon size={17} />
            </span>

            <span className="stamp">
              Knowledge archive / V2
            </span>

            <span className="kicker text-paper/35">
              // {kicker}
            </span>
          </div>

          <h1 className="max-w-4xl font-display text-3xl font-black uppercase leading-[0.87] tracking-[-0.06em] text-paper sm:text-5xl lg:text-6xl">
            {title}
            <span
              className={[
                'font-accent font-normal italic',
                styles.text,
              ].join(' ')}
              aria-hidden="true"
            >
              {' '}
              {accentWord}
            </span>
          </h1>

          <p className="mt-5 max-w-2xl text-sm leading-6 text-paper/48">
            {description}
          </p>

          {action ? (
            <div className="mt-6">
              {action}
            </div>
          ) : null}
        </div>

        {metrics ? (
          <div className="grid grid-cols-2 gap-px overflow-hidden border border-paper/10 bg-paper/10 panel-cut-sm sm:grid-cols-3">
            {metrics}
          </div>
        ) : null}
      </div>
    </motion.header>
  );
}

interface GuideMetricProps {
  icon: LucideIcon;
  value: ReactNode;
  label: string;
  tone?: GuideTone;
}

export function GuideMetric({
  icon: Icon,
  value,
  label,
  tone = 'crimson',
}: GuideMetricProps) {
  return (
    <div className="min-w-28 bg-ink-2/95 p-3 sm:min-w-32">
      <Icon
        size={14}
        className={
          GUIDE_TONE_STYLES[tone].text
        }
        aria-hidden="true"
      />

      <strong className="mt-2 block truncate font-display text-xl font-black text-paper">
        {value}
      </strong>

      <span className="font-mono text-[0.56rem] uppercase tracking-[0.12em] text-paper/32">
        {label}
      </span>
    </div>
  );
}

interface GuideSectionHeadingProps {
  index: string;
  title: string;
  icon?: LucideIcon;
  action?: ReactNode;
}

export function GuideSectionHeading({
  index,
  title,
  icon: Icon,
  action,
}: GuideSectionHeadingProps) {
  return (
    <header className="relative flex items-center gap-3 overflow-hidden py-4">
      <span
        className="text-outline absolute right-3 top-1/2 -translate-y-1/2 font-display text-6xl font-black leading-none"
        aria-hidden="true"
      >
        {index}
      </span>

      {Icon ? (
        <span
          className="grid size-8 place-items-center border border-crimson/30 bg-crimson/10 text-crimson panel-cut-sm"
          aria-hidden="true"
        >
          <Icon size={14} />
        </span>
      ) : null}

      <div className="relative z-10 min-w-0">
        <span className="kicker block text-[0.56rem]">
          // Section {index}
        </span>

        <h2 className="mt-1 font-display text-lg font-black uppercase tracking-[-0.035em] text-paper">
          {title}
        </h2>
      </div>

      <div className="relative z-10 ml-auto">
        {action}
      </div>
    </header>
  );
}

export function GuideDifficultyBadge({
  difficulty,
  label,
}: {
  difficulty: string;
  label: string;
}) {
  const style =
    difficulty === 'beginner'
      ? 'border-mint/45 bg-mint/10 text-mint'
      : difficulty ===
        'intermediate'
        ? 'border-gold/45 bg-gold/10 text-gold'
        : 'border-crimson/45 bg-crimson/10 text-crimson';

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 border px-2 py-1',
        'font-mono text-[0.55rem] font-bold uppercase tracking-[0.1em] panel-cut-sm',
        style,
      ].join(' ')}
    >
      {difficulty === 'beginner' ? (
        <Check
          size={10}
          aria-hidden="true"
        />
      ) : null}
      {label}
    </span>
  );
}

export function GuideEmptyState({
  title,
  description,
  icon: Icon = FileQuestion,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="glass panel-cut halftone grid min-h-72 place-items-center p-8 text-center">
      <div>
        <span
          className="mx-auto grid size-14 place-items-center border border-paper/10 bg-paper/[0.035] text-paper/18 panel-cut-sm"
          aria-hidden="true"
        >
          <Icon
            size={28}
            strokeWidth={1.2}
          />
        </span>

        <h2 className="mt-4 font-display text-lg font-black uppercase tracking-[-0.03em] text-paper">
          {title}
        </h2>

        {description ? (
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-paper/40">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export async function copyGuideText(
  value: string,
): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(
      value,
    );
    return;
  }

  const textarea =
    document.createElement('textarea');

  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';

  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}
