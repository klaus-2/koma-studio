import { useI18n } from '../../i18n';
import { ModelManagerModal, type ModelManagerModalProps } from "./ModelManagerModal";

export type DetectTextModelManagerModalProps = Omit<
  ModelManagerModalProps,
  "selectionStage" | "selectionStageLabel" | "localStageFilter" | "enableCloudCatalog"
>;

export const DetectTextModelManagerModal = (props: DetectTextModelManagerModalProps) => {
  const { t } = useI18n();
  return (
    <ModelManagerModal
      {...props}
      selectionStage="detectText"
      selectionStageLabel={t('modelManager.stage.detectText')}
      localStageFilter="detectText"
      enableCloudCatalog={false}
    />
  );
};

export default DetectTextModelManagerModal;
