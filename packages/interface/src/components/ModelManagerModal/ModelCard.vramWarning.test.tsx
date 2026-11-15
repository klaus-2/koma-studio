// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";

import { setDesktopBridgeProvider } from "@/lib/desktop-bridge";

import { I18nProvider } from "../../i18n";
import {
  getLocalAioModelById,
  getTranslationModelById,
} from "../../models/translation-models-registry";
import type { ModelInstallState } from "../../models/types";
import { useAioPipelineStore } from "@/pages/dashboard/stores/aio-pipeline-store";
import type { AioDeviceInfo } from "../../models/aioStageCatalog";
import StageModelSelect from "../AioStageModelControls/StageModelSelect";
import { ModelCardClassic } from "./ModelCardClassic";
import { ModelCardNoir } from "./noir/ModelCardNoir";

const ABOVE_HARDWARE = "Above your hardware";

beforeAll(() => {
  setDesktopBridgeProvider({ desktop: null });
});

const noopAsync = async (): Promise<void> => undefined;

function deviceInfo(vramGb: number | null): AioDeviceInfo {
  return {
    name: vramGb === null ? "CPU" : "Fake GPU",
    has_gpu: vramGb !== null,
    provider: "CPUExecutionProvider",
    available_providers: ["CPUExecutionProvider"],
    vram_gb: vramGb,
    profile: vramGb === null ? "cpu" : "nvidia-cuda",
    fallback_reason: null,
    nvidia_cuda_available: vramGb !== null,
    nvidia_tensorrt_available: false,
    intel_openvino_available: false,
    amd_rocm_available: false,
  };
}

function setDevice(vramGb: number | null): void {
  useAioPipelineStore.setState({ aioDeviceInfo: deviceInfo(vramGb) });
}

function stateFor(modelId: string): ModelInstallState {
  const model = getTranslationModelById(modelId) ?? getLocalAioModelById(modelId);
  if (!model) {
    throw new Error(`Unknown test model: ${modelId}`);
  }

  return {
    model,
    status: "not_installed",
    installedVersion: null,
    availableVersion: model.version,
    installedAt: null,
    checksumSHA256: null,
    updateAvailable: false,
    error: null,
    errorCode: null,
    progress: null,
    incomplete: false,
  };
}

function renderClassic(modelId: string): RenderResult {
  return render(
    <I18nProvider>
      <ModelCardClassic
        entry={stateFor(modelId)}
        onInstall={noopAsync}
        onUpdate={noopAsync}
        onUninstall={noopAsync}
        onRetry={noopAsync}
        onCancel={noopAsync}
      />
    </I18nProvider>,
  );
}

function renderNoir(modelId: string): RenderResult {
  return render(
    <I18nProvider>
      <ModelCardNoir
        entry={stateFor(modelId)}
        onInstall={noopAsync}
        onUpdate={noopAsync}
        onUninstall={noopAsync}
        onRetry={noopAsync}
        onCancel={noopAsync}
      />
    </I18nProvider>,
  );
}

describe("above-hardware VRAM warning (warn-not-block)", () => {
  it("badges a heavy VLM when the device VRAM is below the declared floor (classic)", () => {
    setDevice(4);
    renderClassic("got_ocr2");

    expect(screen.getByText(ABOVE_HARDWARE)).toBeDefined();
    expect(screen.getByRole("button", { name: /install/i })).toBeEnabled();
  });

  it("badges a heavy VLM on a 4GB device (noir)", () => {
    setDevice(4);
    renderNoir("got_ocr2");

    expect(screen.getByText(ABOVE_HARDWARE)).toBeDefined();
    expect(screen.getByRole("button", { name: /install/i })).toBeEnabled();
  });

  it("hides the badge when the device VRAM covers the declared floor", () => {
    setDevice(16);
    renderClassic("got_ocr2");

    expect(screen.queryByText(ABOVE_HARDWARE)).toBeNull();
  });

  it("hides the badge when the device has no reported VRAM", () => {
    setDevice(null);
    renderNoir("got_ocr2");

    expect(screen.queryByText(ABOVE_HARDWARE)).toBeNull();
  });

  it("never badges models without a declared floor", () => {
    setDevice(1);
    renderClassic("opus-mt-ja-en");

    expect(screen.queryByText(ABOVE_HARDWARE)).toBeNull();
  });
});

describe("StageModelSelect above-hardware hint", () => {
  const options = [
    {
      key: "got_ocr2",
      name: "GOT-OCR 2.0",
      device: "gpu",
      use_case: "VLM OCR",
      available: false,
      implemented: true,
      minVramGb: 8,
    },
  ];

  function renderSelect(deviceVramGb: number | null): RenderResult {
    return render(
      <I18nProvider>
        <StageModelSelect
          label="OCR"
          value="got_ocr2"
          options={options}
          selectedModel={options[0] ?? null}
          statusText={null}
          deviceVramGb={deviceVramGb}
          formatOptionLabel={(option): string => option.name}
          onSelectModel={(): void => undefined}
          onOpenManager={(): void => undefined}
        />
      </I18nProvider>,
    );
  }

  it("shows the hint when the declared floor exceeds the device VRAM", () => {
    renderSelect(4);

    expect(screen.getByText(ABOVE_HARDWARE)).toBeDefined();
    const select = document.querySelector("select");
    expect(select instanceof HTMLSelectElement && select.disabled).toBe(false);
  });

  it("hides the hint when the device VRAM is sufficient", () => {
    renderSelect(12);

    expect(screen.queryByText(ABOVE_HARDWARE)).toBeNull();
  });

  it("hides the hint when the device VRAM is unknown", () => {
    renderSelect(null);

    expect(screen.queryByText(ABOVE_HARDWARE)).toBeNull();
  });

  it("keeps the picker interactive alongside the warning (warn-not-block)", () => {
    renderSelect(4);
    const select = document.querySelector("select");
    expect(select instanceof HTMLSelectElement && select.disabled).toBe(false);
    if (select instanceof HTMLSelectElement) {
      fireEvent.change(select, { target: { value: "got_ocr2" } });
    }
  });
});
