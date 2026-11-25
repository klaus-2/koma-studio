import { Paintbrush, RefreshCcw, Trash2, X } from 'lucide-react';

import { useI18n } from '../../i18n';
import {
  useRegionMultiSelectionActions,
  type RegionMultiSelectionActionBarProps,
} from './RegionMultiSelectionActionBar.controller';

/** Classic skin of the multi-selection action bar (counter + group actions). */
export const RegionMultiSelectionActionBarClassic = (
  props: RegionMultiSelectionActionBarProps,
) => {
  const { t } = useI18n();
  const actions = useRegionMultiSelectionActions(props);

  if (actions.activeImageId === null || actions.selectedRegionIds.length === 0) {
    return null;
  }

  return (
    <div className="koma-aio-pipeline-controls" role="toolbar" aria-label={t("typo.tools.aria")}>
      <span className="koma-tools-hint">
        {t('typo.multiSelect.count', { count: actions.selectedRegionIds.length })}
      </span>
      <button
        type="button"
        className="koma-btn koma-btn--ghost"
        onClick={actions.handleApplyStyle}
      >
        <Paintbrush size={12} /> {t('typo.multiSelect.applyStyle')}
      </button>
      <button
        type="button"
        className="koma-btn koma-btn--ghost"
        onClick={actions.handleRetranslate}
      >
        <RefreshCcw size={12} /> {t('typo.multiSelect.retranslate')}
      </button>
      <button
        type="button"
        className="koma-btn koma-btn--ghost"
        onClick={actions.handleClearSelection}
      >
        <X size={12} /> {t('typo.multiSelect.clear')}
      </button>
      <button
        type="button"
        className="koma-btn koma-btn--ghost"
        style={{ color: 'rgba(244, 63, 94, 0.8)' }}
        onClick={actions.handleDelete}
      >
        <Trash2 size={12} /> {t('typo.multiSelect.delete')}
      </button>
    </div>
  );
};

export default RegionMultiSelectionActionBarClassic;
