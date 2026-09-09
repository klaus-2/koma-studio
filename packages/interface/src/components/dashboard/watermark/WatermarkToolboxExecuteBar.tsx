import { Stamp } from 'lucide-react';

import { useI18n } from '../../../i18n';

type WatermarkExecuteBarProps = {
  processing: boolean;
  imagesCount: number;
  hasRenderableLayer: boolean;
  onProcessBatch: () => Promise<void>;
  onCancelBatch: () => void;
};

export default function WatermarkExecuteBar({
  processing,
  imagesCount,
  hasRenderableLayer,
  onProcessBatch,
  onCancelBatch,
}: WatermarkExecuteBarProps) {
  const { t } = useI18n();

  return (
    <div className="koma-execute-bar">
      <button
        type="button"
        className={`koma-execute-bar__btn${processing ? ' koma-execute-bar__btn--processing' : ''}`}
        disabled={processing || !imagesCount || !hasRenderableLayer}
        onClick={() => void onProcessBatch()}
        aria-busy={processing}
      >
        {processing ? (
          <>
            <span className="auth-spinner" style={{ width: 13, height: 13 }} aria-hidden="true" />{' '}
            {t('watermark.action.applying')}
          </>
        ) : (
          <>
            <Stamp size={13} /> {t('watermark.action.applyBatch')}
          </>
        )}
      </button>
      {processing && (
        <button
          type="button"
          className="koma-execute-bar__btn koma-execute-bar__btn--ghost"
          onClick={onCancelBatch}
          style={{ marginTop: 4 }}
        >
          {t('watermark.action.cancel')}
        </button>
      )}
    </div>
  );
}
