import { Layers } from 'lucide-react';
import { useI18n } from '@/i18n';

export default function OrganizeToolsHint() {
  const { t } = useI18n();

  return (
    <div className="koma-tools__hint">
      <Layers size={18} />
      <div>
        <p>{t('dashboard.organize.hint.reorder')}</p>
        <p>{t('dashboard.organize.hint.rotate')}</p>
      </div>
    </div>
  );
}
