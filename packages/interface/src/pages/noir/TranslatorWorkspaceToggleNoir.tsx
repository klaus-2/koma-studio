'use client';

import { Type, ScanText } from 'lucide-react';
import { useI18n } from '@/i18n';
import { SegToggle } from '../../components/noir-panels/NoirPrimitives';

type TranslatorWorkspaceMode = 'text' | 'visual';

interface Props {
  value: TranslatorWorkspaceMode;
  onChange: (value: TranslatorWorkspaceMode) => void;
}

export const TranslatorWorkspaceToggleNoir = ({ value, onChange }: Props) => {
  const { t } = useI18n();
  return (
    <SegToggle
      ariaLabel={t('dashboard.translator.workspace.ariaLabel')}
      value={value}
      onChange={(v: string) => onChange(v as TranslatorWorkspaceMode)}
      items={[
        { key: 'text', label: t('dashboard.translator.workspace.text'), icon: Type, title: t('dashboard.translator.workspace.textTitle') },
        { key: 'visual', label: t('dashboard.translator.workspace.visual'), icon: ScanText, title: t('dashboard.translator.workspace.visualTitle') },
      ]}
    />
  );
};
