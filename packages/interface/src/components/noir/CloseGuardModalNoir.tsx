import { m, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { useI18n } from '../../i18n';
import { EASE, btnGhost, btnPrimary } from '../system/v2/kit';

interface CloseGuardModalProps {
  open: boolean;
  onCloseAnyway: () => void;
  onCancel: () => void;
}

export const CloseGuardModalNoir = ({
  open,
  onCloseAnyway,
  onCancel,
}: CloseGuardModalProps) => {
  const { t } = useI18n();

  return (
    <AnimatePresence>
      {open && (
        <m.div
          className="fixed inset-0 z-[160] flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
        >
          <m.div
            role="alertdialog"
            aria-modal="true"
            aria-label={t('desktop.closeGuard.title')}
            className="glass panel-cut relative w-full max-w-md p-6"
            initial={{ opacity: 0, scale: 0.92, rotate: -1 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.35, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
          >
            <span aria-hidden className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-crimson via-crimson/40 to-transparent" />
            <div className="mb-4 flex items-center gap-3">
              <span className="panel-cut-sm flex h-10 w-10 items-center justify-center border border-crimson/50 bg-crimson/10 text-crimson">
                <AlertTriangle size={18} />
              </span>
              <div>
                <p className="kicker">// 終了</p>
                <h3 className="font-display text-lg font-black uppercase tracking-tight text-paper">
                  {t('desktop.closeGuard.title')}
                </h3>
              </div>
            </div>
            <p className="mb-4 text-sm text-paper/70">
              {t('desktop.closeGuard.body')}
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onCancel} className={btnGhost}>
                {t('desktop.closeGuard.cancel')}
              </button>
              <button type="button" onClick={onCloseAnyway} className={btnPrimary}>
                {t('desktop.closeGuard.closeAnyway')}
              </button>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
};

export default CloseGuardModalNoir;
