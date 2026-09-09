import { cn } from '@/lib/utils';
import { Type, ScanText } from 'lucide-react';
import { useI18n } from '@/i18n';

type TranslatorWorkspaceMode = 'text' | 'visual';

interface TranslatorWorkspaceToggleProps {
  value: TranslatorWorkspaceMode;
  onChange: (value: TranslatorWorkspaceMode) => void;
}

export const TranslatorWorkspaceToggle = ({
  value,
  onChange,
}: TranslatorWorkspaceToggleProps) => {
  const { t } = useI18n();

  return (
    <div
      className="koma-workspace-toggle"
      role="tablist"
      aria-label={t('dashboard.translator.workspace.ariaLabel')}
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === 'text'}
        className={cn(
          'koma-workspace-toggle__btn',
          value === 'text' && 'koma-workspace-toggle__btn--active',
        )}
        onClick={() => onChange('text')}
        title={t('dashboard.translator.workspace.textTitle')}
      >
        <Type size={12} />
        <span>{t('dashboard.translator.workspace.text')}</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === 'visual'}
        className={cn(
          'koma-workspace-toggle__btn',
          value === 'visual' && 'koma-workspace-toggle__btn--active',
        )}
        onClick={() => onChange('visual')}
        title={t('dashboard.translator.workspace.visualTitle')}
      >
        <ScanText size={12} />
        <span>{t('dashboard.translator.workspace.visual')}</span>
      </button>
    </div>
  );
};
