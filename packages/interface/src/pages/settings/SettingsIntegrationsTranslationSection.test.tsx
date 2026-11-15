// @vitest-environment jsdom

import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setDesktopBridgeProvider } from "@/lib/desktop-bridge";
import { installJsdomBrowserStubs } from "@/components/dashboard/renderTextPreviewTestSetup";
import { WEBHOOK_EVENT_OPTIONS } from "@/services/discordWebhook";
import type { BloggerConfig } from "@koma/types/blogger";
import type { ImgurConfig, ImgurRateLimitStatus } from "@koma/types/imgur";

import { I18nProvider, useI18n } from "../../i18n";
import { translateMessage } from "../../i18n/messages";
import { useSettingsTranslationProviders } from "./hooks/use-settings-translation-providers";
import { renderSettingsIntegrationsTab } from "./SettingsIntegrationsTab";
import { renderSettingsIntegrationsTabNoir } from "./noir/SettingsIntegrationsTabNoir";

beforeEach(() => {
  setDesktopBridgeProvider({ desktop: null });
  installJsdomBrowserStubs();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

type TFn = ReturnType<typeof useI18n>["t"];

const t: TFn = (key, vars) => translateMessage("en", key, vars);

const bloggerConfig: BloggerConfig = {
  label: "",
  clientId: "",
  clientSecret: "",
  refreshToken: "",
  blogId: "",
  defaultLabels: [],
  optimizer: {
    enabled: false,
    provider: "template",
    template: "",
    cloudinary: { cloudName: "", transformation: "", resourceType: "image", deliveryType: "fetch", encodeSourceUrl: false },
  },
  preprocess: {
    enabled: false,
    maxWidth: 1600,
    maxHeight: 1600,
    outputFormat: "jpeg",
    quality: 0.9,
    stripMetadata: true,
  },
};

const imgurConfig: ImgurConfig = { keys: [], rateLimitPerHour: 100, batchDelayMs: 0 };
const imgurRateLimit: ImgurRateLimitStatus = {
  limitPerHour: 100,
  usedThisHour: 0,
  remainingThisHour: 100,
  resetsAt: null,
};

const noop = (): void => undefined;
const noopAsync = async (): Promise<void> => undefined;

const baseArgs = () => ({
  t,
  webhook: {
    url: "",
    enabled: false,
    botName: "",
    events: Object.fromEntries(
      WEBHOOK_EVENT_OPTIONS.map((ev) => [ev.key, false]),
    ) as Record<(typeof WEBHOOK_EVENT_OPTIONS)[number]["key"], boolean>,
  },
  webhookTestStatus: "idle" as const,
  updateWebhook: vi.fn(),
  testWebhook: vi.fn(noopAsync),
  updateWebhookEvent: vi.fn(),
  webhookSaved: false,
  saveWebhook: noop,
  webhookFeedback: null,
  user: null,
  bloggerConfig,
  updateBloggerConfig: vi.fn(),
  updateBloggerNestedConfig: vi.fn(),
  bloggerLabelsInput: "",
  setBloggerLabelsInput: vi.fn(),
  setBloggerSaved: vi.fn(),
  setBloggerFeedback: vi.fn(),
  bloggerSecureStorage: true,
  bloggerTesting: false,
  handleTestBloggerConnection: vi.fn(noopAsync),
  handleSaveBloggerConfig: vi.fn(noopAsync),
  bloggerSaved: false,
  bloggerFeedback: null,
  imgurConfig,
  imgurRateLimit,
  fmtDate: (value: number | string | null): string => String(value ?? ""),
  updateImgurConfig: vi.fn(),
  addImgurKey: vi.fn(),
  updateImgurKey: vi.fn(),
  removeImgurKey: vi.fn(),
  imgurSecureStorage: true,
  handleSaveImgurConfig: vi.fn(noopAsync),
  imgurSaved: false,
  imgurFeedback: null,
  providers: { libretranslateUrl: "", libretranslateApiKey: "", deeplApiKey: "" },
  updateTranslationProvider: vi.fn(),
  providersSaved: false,
  saveTranslationProviders: vi.fn(noopAsync),
  providersFeedback: null,
});

function fetchResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("useSettingsTranslationProviders", () => {
  it("loads the persisted provider config from the local backend", async () => {
    const fetchMock = vi.fn(async () =>
      fetchResponse({
        providerConfig: {
          libretranslate_url: "http://127.0.0.1:5000",
          libretranslate_api_key: null,
          deepl_api_key: "deepl-key",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSettingsTranslationProviders({ t }));

    await waitFor(() => {
      expect(result.current.providers.libretranslateUrl).toBe("http://127.0.0.1:5000");
    });
    expect(result.current.providers.deeplApiKey).toBe("deepl-key");
    expect(result.current.providersFeedback).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/translate/provider-config"),
    );
  });

  it("saves the provider config with null-blanked empty fields", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      typeof init?.body === "string"
        ? fetchResponse({ providerConfig: {} })
        : fetchResponse({ providerConfig: {} }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSettingsTranslationProviders({ t }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    act(() => {
      result.current.updateTranslationProvider("libretranslateUrl", " http://lt:5000 ");
    });
    await act(async () => {
      await result.current.saveTranslationProviders();
    });

    const putCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(putCall).toBeDefined();
    const body = JSON.parse(String(putCall?.[1]?.body)) as Record<string, string | null>;
    expect(body).toEqual({
      libretranslate_url: "http://lt:5000",
      libretranslate_api_key: null,
      deepl_api_key: null,
    });
    expect(result.current.providersSaved).toBe(true);
  });

  it("surfaces an error feedback when the backend refuses", async () => {
    const fetchMock = vi.fn(async () => fetchResponse({ detail: "no" }, 500));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSettingsTranslationProviders({ t }));
    await waitFor(() => {
      expect(result.current.providersFeedback?.type).toBe("error");
    });
    expect(result.current.providersFeedback?.message).toBe(
      t("settings.integrations.translation.loadError"),
    );
  });
});

describe("translation services section (classic + noir parity)", () => {
  it("renders the section in the classic skin with the save action", () => {
    const args = baseArgs();
    const { container } = render(<I18nProvider>{renderSettingsIntegrationsTab(args)}</I18nProvider>);

    expect(screen.getByText("Translation services")).toBeDefined();
    const urlField = screen.getByPlaceholderText("http://127.0.0.1:5000");
    expect(urlField).toBeDefined();
    fireEvent.change(urlField, { target: { value: "http://lt:5000" } });
    expect(args.updateTranslationProvider).toHaveBeenCalledWith(
      "libretranslateUrl",
      "http://lt:5000",
    );

    const section = urlField.closest("section") ?? container;
    fireEvent.click(within(section as HTMLElement).getByText("Save"));
    expect(args.saveTranslationProviders).toHaveBeenCalledTimes(1);
  });

  it("renders the section in the noir skin with the save action", () => {
    const args = baseArgs();
    render(<I18nProvider>{renderSettingsIntegrationsTabNoir(args)}</I18nProvider>);

    expect(screen.getByText("Translation services")).toBeDefined();
    const urlField = screen.getByPlaceholderText("http://127.0.0.1:5000");
    expect(urlField).toBeDefined();
    fireEvent.change(urlField, { target: { value: "http://lt:5000" } });
    expect(args.updateTranslationProvider).toHaveBeenCalledWith(
      "libretranslateUrl",
      "http://lt:5000",
    );

    const section = urlField.closest("section");
    expect(section).not.toBeNull();
    fireEvent.click(within(section as HTMLElement).getByText("Save"));
    expect(args.saveTranslationProviders).toHaveBeenCalledTimes(1);
  });
});
