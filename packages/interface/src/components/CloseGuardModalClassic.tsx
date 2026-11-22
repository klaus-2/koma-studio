import type { JSX } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useI18n } from '../i18n';
import { KomaDialog } from '@koma/ui/components/dialog';
import '@koma/ui/styles/KomaModals.css';
import styles from './CloseGuardModal.module.css';

export interface CloseGuardModalProps {
  open: boolean;
  onCloseAnyway: () => void;
  onCancel: () => void;
}

export const CloseGuardModalClassic = ({
  open,
  onCloseAnyway,
  onCancel,
}: CloseGuardModalProps): JSX.Element | null => {
  const { t } = useI18n();

  if (!open) {
    return null;
  }

  return (
    <KomaDialog
      open
      onClose={onCancel}
      layerClassName="koma-modal-backdrop"
      modalClassName={`koma-modal ${styles.card}`}
      label={t('desktop.closeGuard.title')}
      dismissable={false}
    >
      <div className="koma-modal__title-group">
        <h2 className="koma-modal__title">
          <AlertTriangle size={14} /> {t('desktop.closeGuard.title')}
        </h2>
      </div>
      <div className="koma-modal__body">
        <p className={styles.text}>{t('desktop.closeGuard.body')}</p>
      </div>
      <div className="koma-modal__footer">
        <button
          type="button"
          className="koma-modal__btn koma-modal__btn--ghost"
          onClick={onCancel}
        >
          {t('desktop.closeGuard.cancel')}
        </button>
        <button
          type="button"
          className="koma-modal__btn koma-modal__btn--primary"
          onClick={onCloseAnyway}
        >
          {t('desktop.closeGuard.closeAnyway')}
        </button>
      </div>
    </KomaDialog>
  );
};

export default CloseGuardModalClassic;
