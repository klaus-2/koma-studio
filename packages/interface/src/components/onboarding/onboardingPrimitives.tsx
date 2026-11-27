import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { useThemeStore } from '@koma/ui/stores/theme-store';

export interface OnboardingCardProps {
  children: ReactNode;
  active?: boolean;
  tone?: 'default' | 'accent' | 'info' | 'warn' | 'success';
  className?: string;
}

export const useIsNoirFamily = (): boolean =>
  useThemeStore((s) => s.family) === 'noir';

export function OnboardingSectionCard({
  children,
  active = false,
  tone = 'default',
  className = '',
}: OnboardingCardProps) {
  return (
    <div
      data-active={active ? 'true' : undefined}
      data-tone={tone}
      className={`koma-onb-card ${active ? 'koma-onb-card--active' : ''} koma-onb-card--${tone} ${className}`.trim()}
    >
      {children}
    </div>
  );
}

export interface OnboardingBadgeProps {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'info' | 'warn' | 'success';
}

export function OnboardingBadge({
  children,
  tone = 'neutral',
}: OnboardingBadgeProps) {
  return (
    <span className={`koma-onb-badge koma-onb-badge--${tone}`}>
      {children}
    </span>
  );
}

export interface OnboardingToggleRowProps {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function OnboardingToggleRow({
  title,
  description,
  checked,
  onChange,
}: OnboardingToggleRowProps) {
  return (
    <label className="koma-onb-toggleRow">
      <div className="koma-onb-toggleRow__copy">
        <span className="koma-onb-toggleRow__title">{title}</span>
        <span className="koma-onb-toggleRow__desc">{description}</span>
      </div>
      <span className={`koma-onb-switch ${checked ? 'koma-onb-switch--on' : ''}`}>
        <input
          type="checkbox"
          className="koma-onb-switch__input"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="koma-onb-switch__track">
          <span className="koma-onb-switch__thumb" />
        </span>
      </span>
    </label>
  );
}

export interface OnboardingSelectOption {
  readonly value: string;
  readonly label: string;
}

export interface OnboardingSelectProps {
  id: string;
  value: string;
  options: readonly OnboardingSelectOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
}

export function OnboardingSelect({
  id,
  value,
  options,
  onChange,
  ariaLabel,
}: OnboardingSelectProps) {
  return (
    <div className="koma-onb-selectWrap">
      <select
        id={id}
        aria-label={ariaLabel}
        className="koma-onb-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="koma-onb-selectWrap__icon" aria-hidden="true" />
    </div>
  );
}

export interface OnboardingMeterBarProps {
  label: string;
  value: number;
  tone?: 'accent' | 'info' | 'warn' | 'success';
}

export function OnboardingMeterBar({
  label,
  value,
  tone = 'accent',
}: OnboardingMeterBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="koma-onb-meter">
      <div className="koma-onb-meter__head">
        <span>{label}</span>
        <span className="koma-onb-mono">{clamped}%</span>
      </div>
      <div className="koma-onb-meter__track" aria-hidden="true">
        <div
          className={`koma-onb-meter__fill koma-onb-meter__fill--${tone}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
