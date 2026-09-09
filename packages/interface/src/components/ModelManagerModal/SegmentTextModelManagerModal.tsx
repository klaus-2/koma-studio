import { useI18n } from '../../i18n';
import { ModelManagerModal, type ModelManagerModalProps } from "./ModelManagerModal";

export type SegmentTextModelManagerModalProps = Omit<
  ModelManagerModalProps,
  "selectionStage" | "selectionStageLabel" | "localStageFilter" | "enableCloudCatalog"
>;

export const SegmentTextModelManagerModal = (props: SegmentTextModelManagerModalProps) => {
  const { t } = useI18n();
  return (
    <ModelManagerModal
      {...props}
      selectionStage="segmentText"
      selectionStageLabel={t('modelManager.stage.segmentText')}
      localStageFilter="segmentText"
      enableCloudCatalog={false}
    />
  );
};

export default SegmentTextModelManagerModal;
