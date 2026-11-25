import type { JSX } from 'react';
import { Check } from 'lucide-react';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';
import { useI18n } from '../i18n';

export interface DontShowAgainCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

function DontShowAgainCheckboxClassic({
  checked,
  onChange,
  className = '',
}: DontShowAgainCheckboxProps): JSX.Element {
  const { t } = useI18n();
  return (
    <label
      className={`pointer-events-auto inline-flex cursor-pointer select-none items-center gap-2 text-[12px] ${className}`}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span
        aria-hidden="true"
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-current transition-colors peer-checked:border-purple-500 peer-checked:bg-purple-500 peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-purple-400"
      >
        {checked && <Check size={10} strokeWidth={3} />}
      </span>
      <span>{t('tips.dontShowAgain')}</span>
    </label>
  );
}

function DontShowAgainCheckboxNoir({
  checked,
  onChange,
  className = '',
}: DontShowAgainCheckboxProps): JSX.Element {
  const { t } = useI18n();
  return (
    <label
      className={`pointer-events-auto inline-flex cursor-pointer select-none items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-paper/60 hover:text-paper ${className}`}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span
        aria-hidden="true"
        className="panel-cut-sm flex h-4 w-4 shrink-0 items-center justify-center border border-paper/25 bg-ink text-ink transition-colors peer-checked:border-crimson peer-checked:bg-crimson peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-crimson"
      >
        {checked && <Check size={10} strokeWidth={3} />}
      </span>
      <span>{t('tips.dontShowAgain')}</span>
    </label>
  );
}

export const DontShowAgainCheckbox = createFamilyComponent(
  DontShowAgainCheckboxClassic,
  DontShowAgainCheckboxNoir,
);

export default DontShowAgainCheckbox;
