import { useI18n } from '../../i18n';
import { ModelManagerModal, type ModelManagerModalProps } from "./ModelManagerModal";

export type CleanerAiRecognizeTextModelManagerModalProps = Omit<
  ModelManagerModalProps,
  "selectionStage" | "selectionStageLabel" | "localStageFilter" | "enableCloudCatalog" | "initialSourceFilter" | "hideSourceToggle" | "hideLanguageFilter" | "hideStatusFilter" | "hideFooter" | "hideHeaderMeta"
>;

export const CleanerAiRecognizeTextModelManagerModal = (
  props: CleanerAiRecognizeTextModelManagerModalProps,
) => {
  const { t } = useI18n();
  return (
    <ModelManagerModal
      {...props}
      selectionStage="recognizeText"
      selectionStageLabel={t('modelManager.stage.automaticAiClean')}
      localStageFilter="recognizeText"
      enableCloudCatalog
      initialSourceFilter="cloud"
      hideSourceToggle
      hideLanguageFilter
      hideStatusFilter
      hideFooter
      hideHeaderMeta
    />
  );
};

export default CleanerAiRecognizeTextModelManagerModal;
