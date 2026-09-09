import { validateDiscordWebhookUrl } from "./feed-security.js";
import { tServer } from "./server-i18n.js";

export interface DiscordWebhookSendResult {
  ok: boolean;
  status: number;
  error?: string;
}

export const sendDiscordWebhook = async (
  webhookUrl: string,
  body: Record<string, unknown>,
): Promise<DiscordWebhookSendResult> => {
  const validation = validateDiscordWebhookUrl(webhookUrl, "en");
  if (!validation.valid) {
    return {
      ok: false,
      status: 400,
      error: validation.error ?? tServer("en", "feed.error.invalidDiscordWebhook"),
    };
  }

  try {
    const response = await fetch(validation.normalizedUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const raw = await response.text().catch(() => "");
      return {
        ok: false,
        status: response.status,
        error: raw.trim() || tServer("en", "feed.error.discordWebhookHttp", { status: response.status }),
      };
    }

    return {
      ok: true,
      status: response.status,
    };
  } catch (error) {
    return {
      ok: false,
      status: 503,
      error: error instanceof Error ? error.message : tServer("en", "feed.error.discordWebhookSendFailed"),
    };
  }
};
