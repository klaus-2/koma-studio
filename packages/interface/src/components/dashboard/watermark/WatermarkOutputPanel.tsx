import { Download, FolderOpen, Sparkles } from 'lucide-react';

import { useI18n } from '../../../i18n';
import type { WatermarkResultEntry } from './watermarkTypes';

type WatermarkOutputPanelProps = {
  autoSuggestion: string;
  results: WatermarkResultEntry[];
  selectedResult: WatermarkResultEntry | null;
  supportsDirectorySave: () => boolean;
  onDownloadZip: () => void;
  onSaveToFolder: () => Promise<void>;
  onTriggerBlobDownload: (blob: Blob, fileName: string) => void;
};

export default function WatermarkOutputPanel({
  autoSuggestion,
  results,
  selectedResult,
  supportsDirectorySave,
  onDownloadZip,
  onSaveToFolder,
  onTriggerBlobDownload,
}: WatermarkOutputPanelProps) {
  const { t } = useI18n();
  const canSaveToFolder = supportsDirectorySave();

  return (
    <div className="koma-wm-output">
      <div className="koma-wm-output__head">
        <span className="koma-wm-output__head-icon" aria-hidden="true">
          <Download size={11} />
        </span>
        {t('watermark.panel.output')}
      </div>

      <div className="koma-wm-suggestion">
        <Sparkles size={11} className="koma-wm-suggestion__icon" />
        <span>{autoSuggestion}</span>
      </div>

      {results.length === 0 ? (
        <div className="koma-wm-empty" style={{ padding: '24px 16px' }}>
          <div className="koma-wm-empty__icon">
            <Download size={20} />
          </div>
          <p className="koma-wm-empty__title">{t('watermark.output.empty.title')}</p>
          <p className="koma-wm-empty__desc">
            {t('watermark.output.empty.desc')}
          </p>
        </div>
      ) : (
        <>
          <div className="koma-wm-output__actions">
            <button
              type="button"
              className="koma-btn koma-btn--ghost"
              onClick={onDownloadZip}
            >
              <Download size={11} /> {t('watermark.action.zip')}
            </button>
            <button
              type="button"
              className="koma-btn koma-btn--ghost"
              onClick={() => void onSaveToFolder()}
              disabled={!canSaveToFolder}
            >
              <FolderOpen size={11} /> {t('watermark.action.folder')}
            </button>
            <button
              type="button"
              className="koma-btn koma-btn--primary"
              onClick={() => {
                if (selectedResult) {
                  onTriggerBlobDownload(selectedResult.blob, selectedResult.name);
                }
              }}
              disabled={!selectedResult}
            >
              {t('watermark.action.download')}
            </button>
          </div>
          <div className="koma-wm-results">
            {results.map((entry) => (
              <div key={entry.sourceImageId} className="koma-wm-result">
                <img
                  src={entry.previewUrl}
                  alt={entry.name}
                  className="koma-wm-result__thumb"
                />
                <div className="koma-wm-result__info">
                  <span className="koma-wm-result__name">{entry.name}</span>
                  <span className="koma-wm-result__anchor">
                    {entry.resolvedAnchor}
                  </span>
                </div>
                <button
                  type="button"
                  className="koma-wm-result__dl"
                  onClick={() => onTriggerBlobDownload(entry.blob, entry.name)}
                  aria-label={`${t('watermark.action.download')} ${entry.name}`}
                >
                  <Download size={11} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
