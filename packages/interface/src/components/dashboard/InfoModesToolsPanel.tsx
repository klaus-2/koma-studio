import {
  BookOpen,
  FolderOpen,
  Image as ImageIcon,
  LayoutGrid,
  Sparkles,
} from 'lucide-react';
import { useI18n } from '../../i18n';

interface InfoModesToolsPanelProps {
  mode: string;
}

export default function InfoModesToolsPanel({
  mode,
}: InfoModesToolsPanelProps) {
  const { t } = useI18n();
  if (mode === 'watermark') {
    return (
      <div
        id="koma-watermark-toolbox-host"
        className="koma-watermark-toolbox-host"
      ></div>
    );
  }

  if (mode === 'optimizer') {
    return (
      <div className="koma-tools__hint">
        <Sparkles size={18} />
        <div>
          <p>
            {t('dashboard.info.optimizer.desc1')}
          </p>
          <p>
            {t('dashboard.info.optimizer.desc2')}
          </p>
        </div>
      </div>
    );
  }

  if (mode === 'blogger') {
    return (
      <div className="koma-tools__hint">
        <LayoutGrid size={18} />
        <div>
          <p>
            {t('dashboard.info.blogger.desc1')}
          </p>
          <p>
            {t('dashboard.info.blogger.desc2')}
          </p>
        </div>
      </div>
    );
  }

  if (mode === 'imgur') {
    return (
      <div className="koma-tools__hint">
        <ImageIcon size={18} />
        <div>
          <p>
            {t('dashboard.info.imgur.desc1')}
          </p>
          <p>
            {t('dashboard.info.imgur.desc2')}
          </p>
        </div>
      </div>
    );
  }

  if (mode === 'guides') {
    return (
      <div className="koma-tools__hint">
        <BookOpen size={18} />
        <div>
          <p>
            {t('dashboard.info.guides.desc1')}
          </p>
          <p>{t('dashboard.info.guides.desc2')}</p>
        </div>
      </div>
    );
  }

  if (mode === 'resources') {
    return (
      <div className="koma-tools__hint">
        <FolderOpen size={18} />
        <div>
          <p>
            {t('dashboard.info.resources.desc1')}
          </p>
          <p>{t('dashboard.info.resources.desc2')}</p>
        </div>
      </div>
    );
  }

  return null;
}
