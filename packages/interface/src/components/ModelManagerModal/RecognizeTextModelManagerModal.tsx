import { useI18n } from '../../i18n';
import { ModelManagerModal, type ModelManagerModalProps } from "./ModelManagerModal";

export type RecognizeTextModelManagerModalProps = Omit<
  ModelManagerModalProps,
  "selectionStage" | "selectionStageLabel" | "localStageFilter" | "enableCloudCatalog"
>;

export const RecognizeTextModelManagerModal = (props: RecognizeTextModelManagerModalProps) => {
  const { t } = useI18n();
  return (
    <ModelManagerModal
      {...props}
      selectionStage="recognizeText"
      selectionStageLabel={t('modelManager.stage.recognizeText')}
      localStageFilter="recognizeText"
      enableCloudCatalog
    />
  );
};

export default RecognizeTextModelManagerModal;
