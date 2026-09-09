import { useI18n } from '../../i18n';
import { ModelManagerModal, type ModelManagerModalProps } from "./ModelManagerModal";

export type CleanImageModelManagerModalProps = Omit<
  ModelManagerModalProps,
  "selectionStage" | "selectionStageLabel" | "localStageFilter" | "enableCloudCatalog"
>;

export const CleanImageModelManagerModal = (props: CleanImageModelManagerModalProps) => {
  const { t } = useI18n();
  return (
    <ModelManagerModal
      {...props}
      selectionStage="cleanImage"
      selectionStageLabel={t('modelManager.stage.cleanImage')}
      localStageFilter="cleanImage"
      enableCloudCatalog={false}
    />
  );
};

export default CleanImageModelManagerModal;
