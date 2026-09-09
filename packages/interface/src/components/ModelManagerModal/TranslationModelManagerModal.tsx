import { useI18n } from '../../i18n';
import { ModelManagerModal, type ModelManagerModalProps } from "./ModelManagerModal";

export type TranslationModelManagerModalProps = Omit<
  ModelManagerModalProps,
  "selectionStage" | "selectionStageLabel" | "localStageFilter" | "enableCloudCatalog"
>;

export const TranslationModelManagerModal = (props: TranslationModelManagerModalProps) => {
  const { t } = useI18n();
  return (
    <ModelManagerModal
      {...props}
      selectionStage="translation"
      selectionStageLabel={t("modelManager.stage.translate")}
      localStageFilter="translation"
      enableCloudCatalog
    />
  );
};

export default TranslationModelManagerModal;

