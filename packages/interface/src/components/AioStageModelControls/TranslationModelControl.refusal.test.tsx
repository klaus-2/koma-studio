// @vitest-environment jsdom

import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { setDesktopBridgeProvider } from "@/lib/desktop-bridge";

import type { StageModelRefusalDetail } from "../../aio-stages/transport";
import { I18nProvider } from "../../i18n";
import { useAioModelSelection } from "../../pages/dashboard/hooks/aio-pipeline.catalog.selection";
import { useAioPipelineStore } from "../../pages/dashboard/stores/aio-pipeline-store";
import type { LegacyTranslationOption } from "./types";
import TranslationModelControl from "./TranslationModelControl";

beforeAll(() => {
  setDesktopBridgeProvider({ desktop: null });
});

const REFUSAL: StageModelRefusalDetail = {
  code: "MODEL_NOT_CONFIGURED",
  stage: "translate",
  modelKey: "deepl_translate",
  availableKeys: ["google_translate"],
};

const legacyOptions: LegacyTranslationOption[] = [
  {
    key: "google_translate",
    name: "Google Translate",
    available: true,
    implemented: true,
  },
];

const baseProps = {
  selectedModelId: "deepl_translate",
  sourceLanguage: "ja",
  targetLanguage: "en",
  entries: {},
  legacyOptions,
  installedCount: 0,
  updatesCount: 0,
  selectedSummary: "DeepL Translate",
  supportSummary: "",
  onSelectModel: (): void => undefined,
  onOpenManager: (): void => undefined,
};

function renderControl(
  props?: Partial<React.ComponentProps<typeof TranslationModelControl>>,
): RenderResult {
  return render(
    <I18nProvider>
      <TranslationModelControl {...baseProps} {...props} />
    </I18nProvider>,
  );
}

describe("TranslationModelControl refusal notice", () => {
  beforeEach(() => {
    useAioPipelineStore.setState({ aioStageModelRefusals: {} });
  });

  it("hides the refusal block when no refusal is present", () => {
    renderControl();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("Use default model")).toBeNull();
  });

  it("renders the stored refusal card with the default-model action", () => {
    const onUseDefaultModel = vi.fn();
    renderControl({ refusal: REFUSAL, onUseDefaultModel });

    expect(screen.getByRole("alert")).toBeDefined();
    expect(
      screen.getByText(
        "This service is implemented but not configured. Add the required key or server URL in Settings → Integrations.",
      ),
    ).toBeDefined();
    expect(screen.getByText(/deepl_translate/)).toBeDefined();

    fireEvent.click(screen.getByText("Use default model"));
    expect(onUseDefaultModel).toHaveBeenCalledTimes(1);
  });

  it("forwards re-selection so the store commit clears the refusal", () => {
    const onSelectModel = vi.fn();
    renderControl({ refusal: REFUSAL, onSelectModel });

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "google_translate" },
    });

    expect(onSelectModel).toHaveBeenCalledWith("google_translate");
  });
});

describe("selectAioTranslationModel commit", () => {
  beforeEach(() => {
    useAioPipelineStore.setState({ aioStageModelRefusals: {} });
  });

  it("commits the default model and clears a stored refusal", async () => {
    const { I18nProvider } = await import("../../i18n");
    const wrapper = ({ children }: { children: ReactNode }): ReactNode => (
      <I18nProvider>{children}</I18nProvider>
    );
    const { result } = renderHook(
      () =>
        useAioModelSelection({
          ocrStageOptionsForSelect: [],
          filteredOcrStageOptions: [],
          modelEntries: {},
          openModelManagerForStage: vi.fn(),
          setStatusMessage: vi.fn(),
        }),
      { wrapper },
    );

    act(() => {
      useAioPipelineStore.setState({
        aioStageSelection: {
          ...useAioPipelineStore.getState().aioStageSelection,
          getTranslations: "deepl_translate",
        },
        aioStageModelRefusals: { getTranslations: REFUSAL },
      });
    });

    act(() => {
      result.current.selectAioTranslationModel("google_translate");
    });

    await waitFor(() => {
      expect(
        useAioPipelineStore.getState().aioStageSelection.getTranslations,
      ).toBe("google_translate");
    });
    expect(
      useAioPipelineStore.getState().aioStageModelRefusals.getTranslations,
    ).toBeUndefined();
  });
});
