// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setDesktopBridgeProvider } from "@/lib/desktop-bridge";
import { I18nProvider } from "@/i18n";
import {
  TRANSLATION_MODELS_REGISTRY,
} from "@/models/translation-models-registry";
import { TRANSLATION_AUTO_MODEL_KEY } from "@/utils/translationAutoResolution";
import type { TranslationAutoResolved } from "../../../utils/translationAutoResolution";
import type { ModelInstallState, TranslationModel } from "../../../models/types";
import { modelStore } from "../../../stores/model-store";
import { useAioPipelineStore } from "../stores/aio-pipeline-store";
import AioStageConfigBody from "./AioStageConfigBody";

const { capturedAutoResolved, capturedSelectedModelId } = vi.hoisted(() => {
  const capturedAutoResolved: Array<TranslationAutoResolved | null> = [];
  const capturedSelectedModelId: string[] = [];
  return { capturedAutoResolved, capturedSelectedModelId };
});

vi.mock(
  "../../../components/AioStageModelControls/TranslationModelControl.tsx",
  () => ({
    default: ({
      autoResolved,
      selectedModelId,
    }: {
      autoResolved: TranslationAutoResolved | null;
      selectedModelId: string;
    }) => {
      capturedAutoResolved.push(autoResolved);
      capturedSelectedModelId.push(selectedModelId);
      return null;
    },
  }),
);

type BodyProps = React.ComponentProps<typeof AioStageConfigBody>;

const nllbModel: TranslationModel | undefined =
  TRANSLATION_MODELS_REGISTRY.find(
    (model) => model.id === "nllb-200-600m-int8",
  );
if (!nllbModel) {
  throw new Error("nllb-200-600m-int8 must exist in the translation registry");
}

const installedEntry = (model: TranslationModel): ModelInstallState => ({
  model,
  status: "installed",
  installedVersion: model.version,
  availableVersion: model.version,
  installedAt: null,
  checksumSHA256: model.checksumSHA256,
  updateAvailable: false,
  error: null,
  errorCode: null,
  progress: null,
  incomplete: false,
});

const baseProps = (): BodyProps => ({
  activeStageTab: "getTranslations",
  subMode: "manual",
  availableDetectStageOptions: [],
  availableOcrStageOptions: [],
  availableTranslationStageOptions: [],
  availableSegmentStageOptions: [],
  availableCleanStageOptions: [],
  selectedDetectModel: null,
  selectedOcrModel: null,
  selectedSegmentModel: null,
  selectedCleanModel: null,
  formatAioStageOptionLabel: () => "",
  resolveLocalModelFocusForStage: () => null,
  selectAioLocalStageModel: () => undefined,
  selectAioRecognizeTextModel: () => undefined,
  selectAioTranslationModel: () => undefined,
  selectedDetectStatusText: null,
  selectedOcrStatusText: null,
  selectedSegmentStatusText: null,
  selectedCleanStatusText: null,
  openModelManagerForStage: () => undefined,
  selectedTranslationModelState: null,
  selectedCustomTranslationProfile: null,
  selectedLegacyTranslationOption: null,
  showLlmSettingsPanel: false,
  llmSettingsSupportSummary: "",
  updateActiveRenderMode: () => undefined,
  applyActiveRenderStyleToAllRegions: () => undefined,
  activeImageRenderStageActive: false,
  loadRenderFontCatalog: async () => undefined,
  fontCatalogLoading: false,
  fontCatalogImporting: false,
  fontCatalogError: null,
  fontCatalogInputRef: { current: null },
  handleRenderFontImport: async () => undefined,
  isDesktopRuntime: false,
});

describe("AioStageConfigBody TranslationModelControl Auto wiring", () => {
  beforeEach(() => {
    setDesktopBridgeProvider({ desktop: null, isDesktopRuntime: () => false });
    modelStore.reset();
    useAioPipelineStore.setState((prev) => ({
      aioStageSelection: {
        ...prev.aioStageSelection,
        getTranslations: TRANSLATION_AUTO_MODEL_KEY,
      },
    }));
    capturedAutoResolved.length = 0;
    capturedSelectedModelId.length = 0;
  });

  it("passes the Auto sentinel and a non-null autoResolved to the leaf control", () => {
    modelStore.setState({
      entries: { "nllb-200-600m-int8": installedEntry(nllbModel) },
    });
    render(
      <I18nProvider>
        <AioStageConfigBody {...baseProps()} />
      </I18nProvider>,
    );
    expect(capturedSelectedModelId[0]).toBe(TRANSLATION_AUTO_MODEL_KEY);
    expect(capturedAutoResolved[0]).toEqual({
      key: "nllb-200-600m-int8",
      name: nllbModel.name,
    });
  });
});
