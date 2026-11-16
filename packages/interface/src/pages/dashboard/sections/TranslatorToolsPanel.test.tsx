// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setDesktopBridgeProvider } from "@/lib/desktop-bridge";
import { I18nProvider } from "@/i18n";
import {
  TRANSLATION_MODELS_REGISTRY,
} from "@/models/translation-models-registry";
import { TRANSLATION_AUTO_MODEL_KEY } from "@/utils/translationAutoResolution";
import type { ModelInstallState, TranslationModel } from "../../../models/types";
import { modelStore } from "../../../stores/model-store";
import { useAioPipelineStore } from "../stores/aio-pipeline-store";
import { useTranslatorStore } from "../stores/translator-store";
import TranslatorToolsPanelSection from "./TranslatorToolsPanel";

const { captured } = vi.hoisted(() => {
  const captured: string[] = [];
  return { captured };
});

vi.mock("../../../components/dashboard/TranslatorToolsPanel", () => ({
  default: ({
    translationSelectedSummary,
  }: {
    translationSelectedSummary: string;
  }) => {
    captured.push(translationSelectedSummary);
    return null;
  },
}));

type SectionProps = React.ComponentProps<typeof TranslatorToolsPanelSection>;

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

const baseProps = (): SectionProps => ({
  translatorAvailableOcrStageOptions: [],
  selectedTranslatorOcrCloudOption: null,
  selectedOcrStatusText: null,
  availableTranslationStageOptions: [],
  selectedTranslationModelState: null,
  selectedCustomTranslationProfile: null,
  selectedLegacyTranslationOption: null,
  translatorSelectedLocalTranslationCompatible: true,
  selectedTranslatorSfxCleanOption: null,
  formatAioStageOptionLabel: () => "",
  resolveLocalModelFocusForStage: () => null,
  openModelManagerForStage: () => undefined,
  cleanerAiOptionsForSelect: [],
  selectTranslatorSfxCleanModel: () => undefined,
  showLlmSettingsPanel: false,
  translatorTextImportRef: { current: null },
  translatorImageImportRef: { current: null },
  runTranslatorText: async () => undefined,
  processTranslatorVisual: async () => undefined,
  handleTranslatorTextImport: () => undefined,
  handleTranslatorImageUpload: () => undefined,
  activeId: null,
  retranslateTranslatorRegions: async () => undefined,
});

describe("TranslatorToolsPanelSection translation summary", () => {
  beforeEach(() => {
    setDesktopBridgeProvider({ desktop: null, isDesktopRuntime: () => false });
    modelStore.reset();
    useTranslatorStore.setState({ srcLang: "ja", tgtLang: "en" });
    useAioPipelineStore.setState((prev) => ({
      aioStageSelection: {
        ...prev.aioStageSelection,
        getTranslations: TRANSLATION_AUTO_MODEL_KEY,
      },
    }));
    captured.length = 0;
  });

  it("renders the Auto summary with the resolved model name when one is installed", () => {
    modelStore.setState({
      entries: { "nllb-200-600m-int8": installedEntry(nllbModel) },
    });
    render(
      <I18nProvider>
        <TranslatorToolsPanelSection {...baseProps()} />
      </I18nProvider>,
    );
    expect(captured[0]).toBe(`Auto: ${nllbModel.name}`);
  });

  it("falls back to the select-a-model placeholder when Auto resolves to nothing", () => {
    modelStore.setState({ entries: {} });
    render(
      <I18nProvider>
        <TranslatorToolsPanelSection {...baseProps()} />
      </I18nProvider>,
    );
    expect(captured[0]).toBe(
      "Select a local or cloud model to translate in the Translator.",
    );
  });
});
