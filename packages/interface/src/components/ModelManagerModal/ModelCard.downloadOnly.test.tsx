// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";

import { setDesktopBridgeProvider } from "@/lib/desktop-bridge";

import { I18nProvider } from "../../i18n";
import { getTranslationModelById } from "../../models/translation-models-registry";
import type { ModelInstallState } from "../../models/types";
import { ModelCardClassic } from "./ModelCardClassic";
import { ModelCardNoir } from "./noir/ModelCardNoir";

const DOWNLOAD_ONLY_BADGE = "Download only — no local runtime yet";
const NLLB_MANAGED_MODEL_IDS = [
  "nllb-200-600m-int8",
  "nllb-200-1.3b",
  "nllb-200-1.3b-int8-ct2",
] as const;

beforeAll(() => {
  setDesktopBridgeProvider({ desktop: null });
});

const noopAsync = async (): Promise<void> => undefined;

function stateFor(modelId: string): ModelInstallState {
  const model = getTranslationModelById(modelId);
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

describe("managed NLLB model cards", () => {
  it("no longer renders the classic download-only badge", () => {
    renderClassic("nllb-200-600m-int8");

    expect(screen.queryByText(DOWNLOAD_ONLY_BADGE)).toBeNull();
    expect(screen.queryByTitle(DOWNLOAD_ONLY_BADGE)).toBeNull();
    expect(screen.getByRole("button", { name: /install/i })).toBeEnabled();
  });

  it("no longer renders the noir download-only badge", () => {
    renderNoir("nllb-200-1.3b-int8-ct2");

    expect(screen.queryByText(DOWNLOAD_ONLY_BADGE)).toBeNull();
    expect(screen.queryByTitle(DOWNLOAD_ONLY_BADGE)).toBeNull();
    expect(screen.getByRole("button", { name: /install/i })).toBeEnabled();
  });

  it("renders an enabled install button for every managed NLLB variant in both skins", () => {
    for (const modelId of NLLB_MANAGED_MODEL_IDS) {
      const classic = renderClassic(modelId);
      expect(screen.getByRole("button", { name: /install/i })).toBeEnabled();
      classic.unmount();

      const noir = renderNoir(modelId);
      expect(screen.getByRole("button", { name: /install/i })).toBeEnabled();
      noir.unmount();
    }
  });

  it("does not badge a runnable model in either skin", () => {
    renderClassic("opus-mt-ja-en");
    expect(screen.queryByText(DOWNLOAD_ONLY_BADGE)).toBeNull();
  });

  it("does not badge the noir card of a runnable model", () => {
    renderNoir("opus-mt-ja-en");
    expect(screen.queryByText(DOWNLOAD_ONLY_BADGE)).toBeNull();
  });
});
