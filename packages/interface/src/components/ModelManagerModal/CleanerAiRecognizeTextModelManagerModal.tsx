import { useI18n } from '../../i18n';
import { ModelManagerModal, type ModelManagerModalProps } from "./ModelManagerModal";

export type CleanerAiRecognizeTextModelManagerModalProps = Omit<
  ModelManagerModalProps,
  "selectionStage" | "localStageFilter" | "enableCloudCatalog" | "initialSourceFilter" | "hideLanguageFilter"
>;

export const CleanerAiRecognizeTextModelManagerModal = (
  props: CleanerAiRecognizeTextModelManagerModalProps,
) => {
  const { t } = useI18n();
  return (
    <ModelManagerModal
      {...props}
      selectionStage="imageEdit"
      selectionStageLabel={props.selectionStageLabel ?? t('modelManager.stage.automaticAiClean')}
      localStageFilter="imageEdit"
      enableCloudCatalog
      initialSourceFilter="all"
      hideLanguageFilter
    />
  );
};

export default CleanerAiRecognizeTextModelManagerModal;
