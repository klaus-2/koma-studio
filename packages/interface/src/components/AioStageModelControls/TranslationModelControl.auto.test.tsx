// @vitest-environment jsdom

import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { setDesktopBridgeProvider } from "@/lib/desktop-bridge";

import { I18nProvider } from "../../i18n";
import { useAioModelSelection } from "../../pages/dashboard/hooks/aio-pipeline.catalog.selection";
import { useAioPipelineStore } from "../../pages/dashboard/stores/aio-pipeline-store";
import { TRANSLATION_AUTO_MODEL_KEY } from "../../utils/translationAutoResolution";
import type { LegacyTranslationOption } from "./types";
import TranslationModelControl from "./TranslationModelControl";

beforeAll(() => {
  setDesktopBridgeProvider({ desktop: null });
});

const legacyOptions: LegacyTranslationOption[] = [
  {
    key: "google_translate",
    name: "Google Translate",
    available: true,
    implemented: true,
  },
];

const baseProps = {
  selectedModelId: "google_translate",
  sourceLanguage: "ja",
  targetLanguage: "en",
  entries: {},
  legacyOptions,
  installedCount: 0,
  updatesCount: 0,
  selectedSummary: "Google Translate",
  supportSummary: "",
  autoResolved: {
    key: "nllb-200-600m-int8",
    name: "NLLB-200 600M int8",
  },
  onSelectModel: (): void => undefined,
  onOpenManager: (): void => undefined,
};

function renderControl(
  props?: Partial<React.ComponentProps<typeof TranslationModelControl>>,
): void {
  render(
    <I18nProvider>
      <TranslationModelControl {...baseProps} {...props} />
    </I18nProvider>,
  );
}

describe("TranslationModelControl Auto entry", () => {
  beforeEach(() => {
    useAioPipelineStore.setState({ aioStageModelRefusals: {} });
  });

  it("renders the enabled Auto option before the model groups", () => {
    renderControl();

    const select = screen.getByRole("combobox");
    const autoOption = select.querySelector<HTMLOptionElement>(
      `option[value="${TRANSLATION_AUTO_MODEL_KEY}"]`,
    );
    expect(autoOption).not.toBeNull();
    expect(autoOption?.disabled ?? false).toBe(false);
    expect(autoOption?.textContent).toBe("Auto");
    const firstSelectable = select.querySelector("option:not([disabled])");
    expect(firstSelectable?.getAttribute("value")).toBe(
      TRANSLATION_AUTO_MODEL_KEY,
    );
  });

  it("forwards the Auto sentinel on selection", () => {
    const onSelectModel = vi.fn();
    renderControl({ onSelectModel });

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: TRANSLATION_AUTO_MODEL_KEY },
    });

    expect(onSelectModel).toHaveBeenCalledWith(TRANSLATION_AUTO_MODEL_KEY);
  });

  it("marks the Auto option as selected while the sentinel is persisted", () => {
    renderControl({ selectedModelId: TRANSLATION_AUTO_MODEL_KEY });

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe(TRANSLATION_AUTO_MODEL_KEY);
  });

  it("shows the resolved-variant badge when Auto is selected", () => {
    renderControl({ selectedModelId: TRANSLATION_AUTO_MODEL_KEY });

    expect(screen.getByRole("status").textContent).toContain(
      "Auto: NLLB-200 600M int8",
    );
  });

  it("hides the resolved-variant badge for an explicit pin", () => {
    renderControl({ selectedModelId: "google_translate" });

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("hides the badge when Auto resolves to nothing installed", () => {
    renderControl({
      selectedModelId: TRANSLATION_AUTO_MODEL_KEY,
      autoResolved: null,
    });

    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("selectAioTranslationModel Auto commit", () => {
  beforeEach(() => {
    useAioPipelineStore.setState({ aioStageModelRefusals: {} });
  });

  it("persists the Auto sentinel verbatim and clears a stored refusal", async () => {
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
        aioStageModelRefusals: {
          getTranslations: {
            code: "MODEL_NOT_CONFIGURED",
            stage: "translate",
            modelKey: "deepl_translate",
            availableKeys: ["google_translate"],
          },
        },
      });
    });

    act(() => {
      result.current.selectAioTranslationModel(TRANSLATION_AUTO_MODEL_KEY);
    });

    await waitFor(() => {
      expect(
        useAioPipelineStore.getState().aioStageSelection.getTranslations,
      ).toBe(TRANSLATION_AUTO_MODEL_KEY);
    });
    expect(
      useAioPipelineStore.getState().aioStageModelRefusals.getTranslations,
    ).toBeUndefined();
  });
});
