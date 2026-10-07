'use client';

import {
  SearchX,
  type LucideIcon,
} from 'lucide-react';
import {
  motion,
  useReducedMotion,
} from 'framer-motion';
import type {
  ReactNode,
} from 'react';

import {
  RESOURCE_EASE,
} from './resource-v2-utils';

export type ResourceTone =
  | 'crimson'
  | 'azure'
  | 'mint'
  | 'gold';

export const RESOURCE_TONE = {
  crimson: {
    text: 'text-crimson',
    border: 'border-crimson/40',
    background: 'bg-crimson/10',
    solid: 'bg-crimson',
    shadow:
      'drop-shadow-[6px_6px_0_rgba(255,46,99,0.28)]',
  },
  azure: {
    text: 'text-azure',
    border: 'border-azure/40',
    background: 'bg-azure/10',
    solid: 'bg-azure',
    shadow:
      'drop-shadow-[6px_6px_0_rgba(77,201,255,0.25)]',
  },
  mint: {
    text: 'text-mint',
    border: 'border-mint/40',
    background: 'bg-mint/10',
    solid: 'bg-mint',
    shadow:
      'drop-shadow-[6px_6px_0_rgba(62,242,176,0.22)]',
  },
  gold: {
    text: 'text-gold',
    border: 'border-gold/40',
    background: 'bg-gold/10',
    solid: 'bg-gold',
    shadow:
      'drop-shadow-[6px_6px_0_rgba(255,200,87,0.25)]',
  },
} satisfies Record<
  ResourceTone,
  Record<string, string>
>;

export function resolveResourceTone(
  accent?: string,
): ResourceTone {
  const value =
    accent?.toLowerCase() ?? '';

  if (
    value.includes('cyan') ||
    value.includes('blue') ||
    value.includes('azure')
  ) {
    return 'azure';
  }

  if (
    value.includes('green') ||
    value.includes('emerald') ||
    value.includes('mint')
  ) {
    return 'mint';
  }

  if (
    value.includes('gold') ||
    value.includes('yellow') ||
    value.includes('orange')
  ) {
    return 'gold';
  }

  return 'crimson';
}

interface ResourceNexusHeroProps {
  index?: string;
  kicker: string;
  title: string;
  accent: string;
  description: string;
  icon: LucideIcon;
  action?: ReactNode;
  metrics?: ReactNode;
}

export function ResourceNexusHero({
  index = '07',
  kicker,
  title,
  accent,
  description,
  icon: Icon,
  action,
  metrics,
}: ResourceNexusHeroProps) {
  const reduceMotion =
    useReducedMotion();

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
        clipPath:
          'inset(0 0 0% 0)',
      }}
      transition={{
        duration: reduceMotion
          ? 0
          : 0.68,
        ease: RESOURCE_EASE,
      }}
      className="glass panel-cut manga-grid-bg relative isolate overflow-hidden p-5 sm:p-7 lg:p-8"
    >
      <div
        className="halftone-red pointer-events-none absolute -right-16 -top-20 size-80 opacity-45"
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
        素材・辞書・道具
      </span>

      <div
        className="pointer-events-none absolute bottom-0 left-0 h-[3px] w-2/5 bg-crimson"
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col gap-7 pr-8 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span
              className="grid size-10 place-items-center border border-crimson/35 bg-crimson/10 text-crimson panel-cut-sm"
              aria-hidden="true"
            >
              <Icon size={17} />
            </span>

            <span className="stamp">
              Resource nexus / V2
            </span>

            <span className="kicker text-paper/35">
              // {kicker}
            </span>
          </div>

          <h1 className="font-display text-3xl font-black uppercase leading-[0.87] tracking-[-0.06em] text-paper sm:text-5xl lg:text-6xl">
            {title}
            <span className="font-accent font-normal italic text-crimson">
              {' '}
              {accent}
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

export function ResourceMetric({
  icon: Icon,
  value,
  label,
  tone = 'crimson',
}: {
  icon: LucideIcon;
  value: ReactNode;
  label: string;
  tone?: ResourceTone;
}) {
  return (
    <div className="min-w-28 bg-ink-2/95 p-3 sm:min-w-32">
      <Icon
        size={14}
        className={
          RESOURCE_TONE[tone].text
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

export function ResourceSectionHeader({
  index,
  kicker,
  title,
  description,
  icon: Icon,
  tone = 'crimson',
  action,
}: {
  index: string;
  kicker: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  tone?: ResourceTone;
  action?: ReactNode;
}) {
  const styles =
    RESOURCE_TONE[tone];

  return (
    <header className="relative flex flex-col gap-4 overflow-hidden border-b border-paper/[0.065] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <span
        className="text-outline pointer-events-none absolute right-5 top-0 font-display text-[5.5rem] font-black leading-none"
        aria-hidden="true"
      >
        {index}
      </span>

      <div className="relative z-10 flex items-start gap-3">
        <span
          className={[
            'grid size-10 shrink-0 place-items-center border panel-cut-sm',
            styles.border,
            styles.background,
            styles.text,
          ].join(' ')}
          aria-hidden="true"
        >
          <Icon size={16} />
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
        <div className="relative z-10">
          {action}
        </div>
      ) : null}
    </header>
  );
}

export function ResourceResultCount({
  count,
  singular,
  plural,
}: {
  count: number;
  singular: string;
  plural: string;
}) {
  return (
    <div
      className="flex items-center gap-3"
      role="status"
      aria-live="polite"
    >
      <span className="stamp">
        {String(count).padStart(2, '0')}
      </span>

      <span className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-paper/34">
        {count === 1
          ? singular
          : plural}
      </span>
    </div>
  );
}

interface ResourceFilterOption<Value extends string> {
  value: Value;
  label: string;
  count?: number;
}

export function ResourceFilterRail<
  Value extends string,
>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: Value;
  options: Array<
    ResourceFilterOption<Value>
  >;
  onChange: (value: Value) => void;
  ariaLabel: string;
}) {
  return (
    <div
      className="koma-scrollbar flex gap-2 overflow-x-auto pb-2"
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const active =
          value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            className={[
              'panel-cut-sm inline-flex min-h-9 shrink-0 items-center gap-2 border px-3',
              'font-mono text-[0.6rem] font-bold uppercase tracking-[0.08em] transition',
              active
                ? 'border-crimson bg-crimson text-ink drop-shadow-[3px_3px_0_#ffc857]'
                : 'border-paper/10 bg-paper/[0.025] text-paper/40 hover:border-crimson/35 hover:text-paper',
            ].join(' ')}
            onClick={() =>
              onChange(option.value)
            }
          >
            {option.label}

            {typeof option.count ===
            'number' ? (
              <span
                className={[
                  'grid min-w-5 place-items-center px-1 py-0.5 text-[0.52rem]',
                  active
                    ? 'bg-ink text-paper'
                    : 'bg-paper/[0.055] text-paper/35',
                ].join(' ')}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function ResourceEmptyState({
  query,
  title,
  description,
}: {
  query?: string;
  title: string;
  description: string;
}) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 10,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      role="status"
      className="halftone grid min-h-72 place-items-center border border-dashed border-paper/10 bg-paper/[0.018] p-8 text-center panel-cut"
    >
      <div>
        <span
          className="mx-auto grid size-14 place-items-center border border-paper/10 bg-paper/[0.035] text-paper/18 panel-cut-sm"
          aria-hidden="true"
        >
          <SearchX
            size={28}
            strokeWidth={1.2}
          />
        </span>

        <span className="mt-4 block kicker">
          // Zero matches
        </span>

        <h3 className="mt-2 font-display text-lg font-black uppercase tracking-[-0.03em] text-paper">
          {title}
        </h3>

        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-paper/40">
          {description}
        </p>

        {query ? (
          <code className="mt-4 inline-block border border-crimson/25 bg-crimson/[0.055] px-3 py-2 font-mono text-xs text-crimson panel-cut-sm">
            “{query}”
          </code>
        ) : null}
      </div>
    </motion.div>
  );
}

export function ResourceCardReveal({
  children,
  className = '',
  index = 0,
}: {
  children: ReactNode;
  className?: string;
  index?: number;
}) {
  const reduceMotion =
    useReducedMotion();

  return (
    <motion.div
      initial={
        reduceMotion
          ? false
          : {
              opacity: 0,
              y: 18,
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
        duration: reduceMotion
          ? 0
          : 0.44,
        delay: reduceMotion
          ? 0
          : Math.min(index * 0.035, 0.24),
        ease: RESOURCE_EASE,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
