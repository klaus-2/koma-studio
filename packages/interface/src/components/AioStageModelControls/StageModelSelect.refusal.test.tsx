// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { setDesktopBridgeProvider } from "@/lib/desktop-bridge";

import type { StageModelRefusalDetail } from "../../aio-stages/transport";
import { I18nProvider } from "../../i18n";
import type { AioStageModelOption } from "./types";
import StageModelSelect from "./StageModelSelect";

beforeAll(() => {
  setDesktopBridgeProvider({ desktop: null });
});

const REFUSAL: StageModelRefusalDetail = {
  code: "MODEL_NOT_IMPLEMENTED",
  stage: "segment",
  modelKey: "sam2_text",
  availableKeys: ["baka_content_cc"],
};

const UNKNOWN_REFUSAL: StageModelRefusalDetail = {
  code: "UNKNOWN_MODEL",
  stage: "detect",
  modelKey: "ghost_detector",
  availableKeys: ["font_rtdetr_v2"],
};

const options: AioStageModelOption[] = [
  {
    key: "baka_content_cc",
    name: "Baka Content CC",
    device: "cpu_gpu",
    use_case: "Baka-style segmentation",
    available: true,
    implemented: true,
  },
];

const baseProps = {
  label: "Segment",
  value: "baka_content_cc",
  options,
  selectedModel: options[0] ?? null,
  statusText: null,
  formatOptionLabel: (option: { name: string }): string => option.name,
  onSelectModel: (): void => undefined,
  onOpenManager: (): void => undefined,
};

function renderSelect(props?: Partial<React.ComponentProps<typeof StageModelSelect>>): RenderResult {
  return render(
    <I18nProvider>
      <StageModelSelect {...baseProps} {...props} />
    </I18nProvider>,
  );
}

describe("StageModelSelect refusal notice", () => {
  it("hides the refusal block when no refusal is present", () => {
    renderSelect();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("Use default model")).toBeNull();
  });

  it("renders the refusal warning with alternatives and the default-model action", () => {
    const onUseDefaultModel = vi.fn();
    renderSelect({ refusal: REFUSAL, onUseDefaultModel });

    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByText("Model not implemented")).toBeDefined();
    expect(screen.getByText(/baka_content_cc/)).toBeDefined();

    fireEvent.click(screen.getByText("Use default model"));
    expect(onUseDefaultModel).toHaveBeenCalledTimes(1);
  });

  it("labels unknown keys with the unknown-model title", () => {
    renderSelect({ refusal: UNKNOWN_REFUSAL, onUseDefaultModel: vi.fn() });
    expect(screen.getByText("Unknown model")).toBeDefined();
  });

  it("keeps the select enabled alongside the warning (warn-not-block)", () => {
    renderSelect({ refusal: REFUSAL, onUseDefaultModel: vi.fn() });
    const select = document.querySelector("select");
    expect(select).not.toBeNull();
    expect(select instanceof HTMLSelectElement && select.disabled).toBe(false);
  });
});
