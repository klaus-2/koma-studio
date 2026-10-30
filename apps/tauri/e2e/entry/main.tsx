import { setDesktopBridgeProvider } from "@koma/interface/lib/desktop-bridge";
import { setRuntimeAdapter } from "@koma/auth/runtime-adapter";
import { setUiI18n } from "@koma/ui/i18n-port";
import { buildUrl } from "@koma/interface/config/api";
import { useI18n } from "@koma/interface/i18n";
import type { RuntimeConfig } from "@shared/desktop-api";

import { createE2eBridge } from "./e2e-bridge";
import { installE2eState } from "./e2e-state";

const runtimeConfig: RuntimeConfig = {
  authApiUrl:
    import.meta.env.VITE_AUTH_API_URL ?? "http://127.0.0.1:3001",
  localApiUrl:
    import.meta.env.VITE_LOCAL_API_URL ?? "http://127.0.0.1:8001",
  appPackaged: false,
};

const provider = createE2eBridge(runtimeConfig);
setDesktopBridgeProvider(provider);

setRuntimeAdapter({
  isDesktopRuntime: () => true,
  getDesktopAuthApi: () => provider.desktop?.api.auth ?? null,
  isAuthDisabled: () => true,
  buildUrl,
  getDesktopUpdatePolicyHeaders: () => ({}),
  useUpdaterBlocking: () => false,
});

setUiI18n(useI18n);
installE2eState();

void import("@koma/interface/main");
