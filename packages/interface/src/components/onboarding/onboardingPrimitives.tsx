import { useEffect, useId, useRef, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { useThemeStore } from '@koma/ui/stores/theme-store';

import { InkToggle } from '../../pages/settings/noir/primitives';
import { useOnbSkin, type OnbTone } from './onboardingSkin';

export const cx = (...parts: (string | false | null | undefined)[]): string =>
  parts.filter(Boolean).join(' ');

export const useIsNoirFamily = (): boolean =>
  useThemeStore((s) => s.family) === 'noir';

export function OnbSection({
  icon,
  title,
  desc,
  actions,
  children,
  className,
  titleId: titleIdProp,
}: {
  icon?: ReactNode;
  title: string;
  desc?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  titleId?: string;
}) {
  const skin = useOnbSkin();
  const generatedId = useId();
  const titleId = titleIdProp ?? generatedId;
  return (
    <section aria-labelledby={titleId} className={cx(skin.section, className)}>
      <header className={cx('flex flex-col gap-1.5', children ? 'mb-4' : '')}>
        <div className="flex flex-wrap items-start justify-between gap-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {icon ? <span aria-hidden="true" className={skin.sectionIcon}>{icon}</span> : null}
            <h3 id={titleId} className={cx('min-w-0', skin.sectionTitle)}>{title}</h3>
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        {desc ? <p className={cx(skin.sectionDesc, icon ? 'sm:pl-11' : false)}>{desc}</p> : null}
      </header>
      {children}
    </section>
  );
}

export function OnbBadge({ tone = 'neutral', children }: { tone?: OnbTone; children: ReactNode }) {
  const skin = useOnbSkin();
  return <span className={skin.badge(tone)}>{children}</span>;
}

export function OnbNotice({
  tone = 'info',
  role,
  children,
}: {
  tone?: OnbTone;
  role?: 'status' | 'alert';
  children: ReactNode;
}) {
  const skin = useOnbSkin();
  return (
    <div role={role} className={skin.notice(tone)}>
      {children}
    </div>
  );
}

export function OnbField({
  label,
  htmlFor,
  labelId,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  labelId?: string;
  hint?: string;
  children: ReactNode;
}) {
  const skin = useOnbSkin();
  const marker = skin.noir ? <span aria-hidden="true" className="text-crimson">// </span> : null;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {htmlFor ? (
        <label htmlFor={htmlFor} className={skin.label}>{marker}{label}</label>
      ) : (
        <span id={labelId} className={skin.label}>{marker}{label}</span>
      )}
      {hint ? <p className={skin.hint}>{hint}</p> : null}
      {children}
    </div>
  );
}

export interface OnbOption<T extends string | number> {
  readonly value: T;
  readonly label: string;
  readonly icon?: ReactNode;
}

export function OnbSelect({
  id,
  value,
  options,
  onChange,
}: {
  id: string;
  value: string;
  options: readonly OnbOption<string>[];
  onChange: (value: string) => void;
}) {
  const skin = useOnbSkin();
  return (
    <div className="relative">
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={cx(skin.select, 'pr-8')}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <ChevronDown
        size={14}
        aria-hidden="true"
        className={cx(
          'pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2',
          skin.noir ? 'text-paper/45' : 'koma-onb-c-chevron',
        )}
      />
    </div>
  );
}

export function OnbCheckbox({
  checked,
  indeterminate = false,
  disabled,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  const skin = useOnbSkin();
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className={skin.checkbox}
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

export function OnbToggleRow({
  title,
  desc,
  checked,
  onChange,
}: {
  title: string;
  desc?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const skin = useOnbSkin();
  return (
    <label className={cx(skin.row, 'cursor-pointer')}>
      <span className="min-w-0">
        <span className={skin.rowTitle}>{title}</span>
        {desc ? <span className={skin.rowDesc}>{desc}</span> : null}
      </span>
      {skin.noir ? (
        <InkToggle checked={checked} onChange={onChange} />
      ) : (
        <span className={cx('koma-toggle', checked && 'koma-toggle--on')}>
          <input
            type="checkbox"
            role="switch"
            aria-checked={checked}
            className="koma-toggle__input"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="koma-toggle__track"><span className="koma-toggle__thumb" /></span>
        </span>
      )}
    </label>
  );
}

export function OnbMeter({ label, value, tone }: { label: string; value: number; tone: OnbTone }) {
  const skin = useOnbSkin();
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className={skin.label}>{label}</span>
        <span className={skin.mono}>{clamped}</span>
      </div>
      <div className={skin.track} aria-hidden="true">
        <div className={cx(skin.fill, `koma-onb-meter--${tone}`)} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
