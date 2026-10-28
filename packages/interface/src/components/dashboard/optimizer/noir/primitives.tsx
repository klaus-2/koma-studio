import { useId, type ReactNode } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { ChevronDown, type LucideIcon } from 'lucide-react';

import { EASE } from '../../../system/v2/kit';

interface ControlSectionProps {
  index: string;
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  expanded?: boolean;
  onToggle?: () => void;
}

export function ControlSection({
  index,
  icon: Icon,
  title,
  children,
  expanded = true,
  onToggle,
}: ControlSectionProps) {
  const contentId = useId();
  const reduceMotion = useReducedMotion();

  const header = (
    <>
      <span
        className="text-outline font-display font-black text-[58px] leading-none select-none pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 opacity-[0.12]"
        aria-hidden="true"
      >
        {index}
      </span>

      <span
        className="relative grid size-8 shrink-0 place-items-center border border-crimson/30 bg-crimson/10 text-crimson panel-cut-sm"
        aria-hidden="true"
      >
        <Icon size={13} />
      </span>

      <span className="relative min-w-0 flex-1 text-left">
        <span className="kicker block text-[0.58rem]">
          // {index}
        </span>

        <span className="mt-1 block font-display text-sm font-black uppercase tracking-[-0.025em] text-paper">
          {title}
        </span>
      </span>

      {onToggle ? (
        <span
          className={[
            'relative grid size-7 place-items-center border border-paper/10',
            'bg-paper/[0.035] text-paper/45 panel-cut-sm',
            'transition-transform duration-300',
            expanded ? 'rotate-180' : '',
          ].join(' ')}
          aria-hidden="true"
        >
          <ChevronDown size={13} />
        </span>
      ) : null}
    </>
  );

  return (
    <section className="border-b border-paper/[0.065] last:border-b-0">
      {onToggle ? (
        <button
          type="button"
          className="panel-cut-sm relative flex w-full items-center gap-3 px-4 py-4 hover:bg-paper/[0.025]"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={onToggle}
        >
          {header}
        </button>
      ) : (
        <div className="relative flex items-center gap-3 px-4 py-4">
          {header}
        </div>
      )}

      <AnimatePresence initial={false}>
        {expanded ? (
          <m.div
            id={contentId}
            initial={
              reduceMotion
                ? false
                : {
                  height: 0,
                  opacity: 0,
                }
            }
            animate={{
              height: 'auto',
              opacity: 1,
            }}
            exit={{
              height: 0,
              opacity: 0,
            }}
            transition={{
              duration: reduceMotion ? 0 : 0.3,
              ease: EASE,
            }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-5">
              {children}
            </div>
          </m.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

interface ToggleControlProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: LucideIcon;
}

export function ToggleControl({
  label,
  checked,
  onChange,
  icon: Icon,
}: ToggleControlProps) {
  return (
    <label className="panel-cut-sm flex min-h-12 cursor-pointer items-center gap-3 border border-paper/10 bg-ink/45 px-3 py-2.5 transition-colors hover:border-paper/20 hover:bg-paper/[0.035] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-crimson">
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
          'relative h-5 w-9 shrink-0 border transition-colors panel-cut-sm',
          checked
            ? 'border-crimson bg-crimson/20'
            : 'border-paper/15 bg-ink-2',
        ].join(' ')}
        aria-hidden="true"
      >
        <m.span
          layout
          transition={{ ease: EASE, duration: 0.2 }}
          className={[
            'absolute top-0.5 size-3.5 transition-colors',
            checked
              ? 'left-[18px] bg-crimson'
              : 'left-0.5 bg-paper/50',
          ].join(' ')}
        />
      </span>

      <span className="flex min-w-0 items-center gap-2 font-mono text-[0.67rem] font-bold uppercase tracking-[0.08em] text-paper/58">
        {Icon ? (
          <Icon
            size={13}
            className={
              checked ? 'text-crimson' : 'text-paper/35'
            }
            aria-hidden="true"
          />
        ) : null}

        {label}
      </span>
    </label>
  );
}

interface RangeControlProps {
  label: string;
  valueLabel: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  icon?: LucideIcon;
}

export function RangeControl({
  label,
  valueLabel,
  min,
  max,
  step,
  value,
  onChange,
  disabled = false,
  icon: Icon,
}: RangeControlProps) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between gap-4">
        <span className="flex items-center gap-2 font-mono text-[0.65rem] font-bold uppercase tracking-[0.1em] text-paper/48">
          {Icon ? (
            <Icon
              size={13}
              className="text-crimson"
              aria-hidden="true"
            />
          ) : null}
          {label}
        </span>

        <output className="stamp !px-2 !py-1 !text-[0.58rem]">
          {valueLabel}
        </output>
      </span>

      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) =>
          onChange(Number(event.target.value))
        }
        className={[
          'w-full h-1 appearance-none bg-paper/15 cursor-pointer',
          '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3',
          '[&::-webkit-slider-thumb]:bg-crimson [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-ink [&::-webkit-slider-thumb]:cursor-pointer',
          '[&::-webkit-slider-thumb]:shadow-[2px_2px_0_0_rgba(255,200,87,0.4)]',
          '[&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:bg-crimson [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer',
        ].join(' ')}
      />
    </label>
  );
}
