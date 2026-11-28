import type { KeyboardEvent, ReactNode } from 'react';
import { Check } from 'lucide-react';

import { cx, type OnbOption } from './onboardingPrimitives';
import { useOnbSkin } from './onboardingSkin';

const rovingTarget = (key: string, current: number, count: number): number | null => {
  if (count === 0) return null;
  if (key === 'ArrowRight' || key === 'ArrowDown') return (current + 1) % count;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (current - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
};

const moveRoving = <T,>(
  event: KeyboardEvent<HTMLElement>,
  role: string,
  values: readonly T[],
  current: T,
  onChange: (value: T) => void,
): void => {
  const next = rovingTarget(event.key, Math.max(0, values.indexOf(current)), values.length);
  if (next === null) return;
  event.preventDefault();
  const value = values[next];
  if (value === undefined) return;
  onChange(value);
  event.currentTarget.querySelectorAll<HTMLElement>(`[role="${role}"]`)[next]?.focus();
};

export function OnbSegmented<T extends string | number>({
  labelledBy,
  value,
  options,
  onChange,
}: {
  labelledBy: string;
  value: T;
  options: readonly OnbOption<T>[];
  onChange: (value: T) => void;
}) {
  const skin = useOnbSkin();
  const values = options.map((opt) => opt.value);
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className={skin.segment}
      onKeyDown={(e) => moveRoving(e, 'radio', values, value, onChange)}
    >
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(opt.value)}
            className={cx(skin.segmentItem, on ? skin.segmentOn : skin.segmentOff)}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export interface OnbChoice<T extends string> {
  readonly value: T;
  readonly title: string;
  readonly desc: string;
  readonly media: ReactNode;
}

export function OnbChoiceGroup<T extends string>({
  labelledBy,
  value,
  options,
  onChange,
}: {
  labelledBy: string;
  value: T;
  options: readonly OnbChoice<T>[];
  onChange: (value: T) => void;
}) {
  const skin = useOnbSkin();
  const values = options.map((opt) => opt.value);
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className="grid gap-2 sm:grid-cols-2"
      onKeyDown={(e) => moveRoving(e, 'radio', values, value, onChange)}
    >
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(opt.value)}
            className={cx(skin.choice, on ? skin.choiceOn : skin.choiceOff)}
          >
            {opt.media}
            <span className="min-w-0 flex-1">
              <span className={cx('block', skin.itemTitle)}>{opt.title}</span>
              <span className={cx('mt-0.5 block', skin.muted)}>{opt.desc}</span>
            </span>
            <Check
              size={14}
              strokeWidth={3}
              aria-hidden="true"
              className={cx('shrink-0', on ? (skin.noir ? 'text-crimson' : 'koma-onb-c-accent') : 'invisible')}
            />
          </button>
        );
      })}
    </div>
  );
}

export const tabId = (base: string, id: string): string => `${base}-tab-${id}`;

export const tabPanelProps = (base: string, id: string) => ({
  id: `${base}-panel`,
  role: 'tabpanel' as const,
  'aria-labelledby': tabId(base, id),
  tabIndex: 0,
});

export function OnbTabs<T extends string>({
  idBase,
  label,
  value,
  tabs,
  onChange,
  variant = 'scroll',
}: {
  idBase: string;
  label: string;
  value: T;
  tabs: readonly OnbOption<T>[];
  onChange: (value: T) => void;
  variant?: 'scroll' | 'grid';
}) {
  const skin = useOnbSkin();
  const values = tabs.map((tab) => tab.value);
  return (
    <div
      role="tablist"
      aria-label={label}
      className={
        variant === 'grid'
          ? 'grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6'
          : '-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1'
      }
      onKeyDown={(e) => moveRoving(e, 'tab', values, value, onChange)}
    >
      {tabs.map((tab) => {
        const on = tab.value === value;
        return (
          <button
            key={tab.value}
            id={tabId(idBase, tab.value)}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls={`${idBase}-panel`}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(tab.value)}
            className={cx(
              skin.tab,
              variant === 'grid' ? 'min-w-0 justify-center text-center' : null,
              on ? skin.tabOn : skin.tabOff,
            )}
          >
            {tab.icon}
            <span className={variant === 'grid' ? 'truncate' : undefined}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
