import { memo } from 'react';
import { X } from 'lucide-react';

import { useI18n } from '../../../i18n';
import AioBatchPauseButton from './AioBatchPauseButton';

interface AioExecuteActionsRowProps {
  subMode: 'auto' | 'manual';
  runActive: boolean;
  onStop: () => void;
}

export default memo(function AioExecuteActionsRow({
  subMode,
  runActive,
  onStop,
}: AioExecuteActionsRowProps) {
  const { t } = useI18n();
  return (
    <div className="koma-aio-execute__row">
      <AioBatchPauseButton subMode={subMode} />
      {runActive && (
        <button
          type="button"
          className="koma-aio-execute__btn koma-aio-execute__btn--stop"
          onClick={onStop}
        >
          <span
            className="auth-spinner"
            style={{ width: 14, height: 14 }}
            aria-hidden="true"
          />
          <X size={14} />
          {t("dashboard.dashboardExecute.stop")}
        </button>
      )}
    </div>
  );
});