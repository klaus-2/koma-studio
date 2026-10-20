/**
 * External network host allowlist (dynamic URLs + static suffixes).
 */
import { normalizeHost } from "./shared.ts";
import { resolveDesktopEnvValue } from "./runtime-env.ts";

const EXTERNAL_ALLOWED_HOST_SUFFIXES = [
  "stripe.com",
  "mercadopago.com",
  "mercadopago.com.br",
  "github.com",
  "githubusercontent.com",
  "discord.com",
  "discord.gg",
  "komikkulab.com",
  "cloudflare.com",
  "huggingface.co",
  "openmodeldb.info",
];
const externalAllowedHosts = new Set<string>();

let configuredAuthApiUrl = "";
let configuredLocalApiUrl = "";

const configureExternalHosts = (deps: {
  authApiUrl: string;
  localApiUrl: string;
}): void => {
  configuredAuthApiUrl = deps.authApiUrl;
  configuredLocalApiUrl = deps.localApiUrl;
};

const registerAllowedExternalHostFromUrl = (rawUrl: string | null): void => {
  if (!rawUrl) {
    return;
  }
  try {
    const parsed = new URL(rawUrl);
    externalAllowedHosts.add(normalizeHost(parsed.hostname));
  } catch {
    // Ignore malformed URLs from env/runtime overrides.
  }
};

const hydrateAllowedExternalHosts = (): void => {
  if (externalAllowedHosts.size > 0) {
    return;
  }

  registerAllowedExternalHostFromUrl(configuredAuthApiUrl);
  registerAllowedExternalHostFromUrl(configuredLocalApiUrl);
  registerAllowedExternalHostFromUrl(resolveDesktopEnvValue("UPDATE_SERVER_URL"));
  registerAllowedExternalHostFromUrl(resolveDesktopEnvValue("VITE_PROJECT_WEBSITE_URL"));
  registerAllowedExternalHostFromUrl(resolveDesktopEnvValue("VITE_PROJECT_DISCORD_URL"));
  registerAllowedExternalHostFromUrl(resolveDesktopEnvValue("VITE_PROJECT_BUG_URL"));
};

const isAllowedExternalUrl = (rawUrl: string): boolean => {
  try {
    hydrateAllowedExternalHosts();
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") {
      return false;
    }

    const host = parsed.hostname.toLowerCase();
    if (externalAllowedHosts.has(host)) {
      return true;
    }

    return EXTERNAL_ALLOWED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
};

export {
  configureExternalHosts,
  isAllowedExternalUrl,
  registerAllowedExternalHostFromUrl,
};
