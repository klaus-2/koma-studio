import { useMemo } from 'react';

import { useI18n } from '../../../i18n';
import type { useDashboardModelManager } from '../../../hooks/useDashboardModelManager';
import {
  ENHANCE_OUTPUT_FORMATS,
  getEnhanceProfileLabels,
} from '../../../constants/dashboard.constants';
import type {
  useDashboardEnhanceActions,
  useEnhanceInstallAction,
  useEnhanceModelSelection,
} from '../hooks/enhance';
import { useEnhanceStore } from '../stores/enhance-store';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useUiShellStore } from '../stores/ui-shell-store';
import EnhanceToolsPanel from '../../../components/dashboard/EnhanceToolsPanel';

type EnhanceModelSelectionApi = ReturnType<typeof useEnhanceModelSelection>;
type EnhanceInstallActionApi = ReturnType<typeof useEnhanceInstallAction>;
type EnhanceActionsApi = ReturnType<typeof useDashboardEnhanceActions>;
type DashboardModelManagerApi = ReturnType<typeof useDashboardModelManager>;

interface EnhanceToolsPanelSectionProps {
  /* ── Page runtime flag ── */
  isDesktopRuntime: boolean;

  /* ── Enhance model selection + action hooks (dashboard/hooks/enhance) ── */
  selectedEnhanceModel: EnhanceModelSelectionApi['selectedEnhanceModel'];
  selectedEnhanceInstallState: EnhanceModelSelectionApi['selectedEnhanceInstallState'];
  filteredEnhanceModels: EnhanceModelSelectionApi['filteredEnhanceModels'];
  setEnhanceModelManagerOpen: DashboardModelManagerApi['setEnhanceModelManagerOpen'];
  importSelectedEnhanceModel: EnhanceActionsApi['importSelectedEnhanceModel'];
  installSelectedEnhanceModel: EnhanceInstallActionApi;
  processEnhance: EnhanceActionsApi['processEnhance'];
}

/**
 * Enhance tools panel view (the `{mode === 'enhance'}` block).
 * Reads the enhance/shell/image stores and forwards the same-name props
 * the page previously passed (model memos and action hooks stay page props).
 */
export default function EnhanceToolsPanelSection({
  isDesktopRuntime,
  selectedEnhanceModel,
  selectedEnhanceInstallState,
  filteredEnhanceModels,
  setEnhanceModelManagerOpen,
  importSelectedEnhanceModel,
  installSelectedEnhanceModel,
  processEnhance,
}: EnhanceToolsPanelSectionProps) {
  const { t } = useI18n();
  const enhanceScale = useEnhanceStore((s) => s.enhanceScale);
  const setEnhanceScale = useEnhanceStore((s) => s.setEnhanceScale);
  const enhanceProfile = useEnhanceStore((s) => s.enhanceProfile);
  const setEnhanceProfile = useEnhanceStore((s) => s.setEnhanceProfile);
  const enhanceOutputFormat = useEnhanceStore((s) => s.enhanceOutputFormat);
  const setEnhanceOutputFormat = useEnhanceStore((s) => s.setEnhanceOutputFormat);
  const enhanceActionBusy = useEnhanceStore((s) => s.enhanceActionBusy);
  const setEnhanceModelId = useEnhanceStore((s) => s.setEnhanceModelId);
  const processing = useUiShellStore((s) => s.processing);
  const images = useImageCollectionStore((s) => s.images);
  const enhanceProfileLabels = useMemo(() => getEnhanceProfileLabels(t), [t]);

  return (
    <EnhanceToolsPanel
      isDesktopRuntime={isDesktopRuntime}
      enhanceScale={enhanceScale}
      setEnhanceScale={setEnhanceScale}
      enhanceProfile={enhanceProfile}
      setEnhanceProfile={(value) =>
        setEnhanceProfile(value as unknown as Parameters<typeof setEnhanceProfile>[0])
      }
      enhanceOutputFormat={enhanceOutputFormat}
      setEnhanceOutputFormat={setEnhanceOutputFormat}
      selectedEnhanceModel={selectedEnhanceModel}
      selectedEnhanceInstallState={selectedEnhanceInstallState}
      filteredEnhanceModels={filteredEnhanceModels}
      enhanceActionBusy={enhanceActionBusy}
      processing={processing}
      imagesCount={images.length}
      setEnhanceModelId={setEnhanceModelId}
      setEnhanceModelManagerOpen={setEnhanceModelManagerOpen}
      importSelectedEnhanceModel={importSelectedEnhanceModel}
      installSelectedEnhanceModel={installSelectedEnhanceModel}
      processEnhance={processEnhance}
      enhanceProfileLabels={enhanceProfileLabels}
      enhanceOutputFormats={[...ENHANCE_OUTPUT_FORMATS]}
    />
  );
}
