import { Paintbrush, RefreshCcw, Trash2, X } from 'lucide-react';

import { useI18n } from '../../../i18n';
import { btnGhost } from '../../../pages/settings/noir/primitives';
import {
  useRegionMultiSelectionActions,
  type RegionMultiSelectionActionBarProps,
} from '../RegionMultiSelectionActionBar';

/** Noir skin of the multi-selection action bar (counter + group actions). */
export const RegionMultiSelectionActionBarNoir = (
  props: RegionMultiSelectionActionBarProps,
) => {
  const { t } = useI18n();
  const actions = useRegionMultiSelectionActions(props);

  if (actions.activeImageId === null || actions.selectedRegionIds.length === 0) {
    return null;
  }

  return (
    <div
      role="toolbar"
      aria-label={t("typo.tools.aria")}
      className="flex flex-wrap items-center gap-1.5 border border-paper/12 bg-ink p-1.5 panel-cut-sm"
    >
      <span className="font-mono text-[9px] uppercase tracking-wider text-paper/40">
        {t('typo.multiSelect.count', { count: actions.selectedRegionIds.length })}
      </span>
      <button
        type="button"
        className={btnGhost}
        onClick={actions.handleApplyStyle}
      >
        <Paintbrush size={11} /> {t('typo.multiSelect.applyStyle')}
      </button>
      <button
        type="button"
        className={btnGhost}
        onClick={actions.handleRetranslate}
      >
        <RefreshCcw size={11} /> {t('typo.multiSelect.retranslate')}
      </button>
      <button
        type="button"
        className={btnGhost}
        onClick={actions.handleClearSelection}
      >
        <X size={11} /> {t('typo.multiSelect.clear')}
      </button>
      <button
        type="button"
        onClick={actions.handleDelete}
        className="inline-flex items-center gap-1.5 border border-crimson/40 bg-crimson/8 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-crimson transition-colors hover:bg-crimson/15"
      >
        <Trash2 size={11} /> {t('typo.multiSelect.delete')}
      </button>
    </div>
  );
};

export default RegionMultiSelectionActionBarNoir;
