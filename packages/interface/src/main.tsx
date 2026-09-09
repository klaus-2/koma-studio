// Single interface render module. The shell (electron/tauri) registers the
// provider + auth adapter + i18n port BEFORE importing this file.
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";

import App from "./App";
import "@koma/ui/styles/tokens.css";
import "./App.css";
import "@koma/ui/styles/cursor.css";
import "@koma/ui/styles/page-transition.css";
import "./pages/guides-resources.css";
import { I18nProvider } from "./i18n";
import { appQueryClient } from "./query/client";
import { desktopBridge } from "@/lib/desktop-bridge";
import brandLogoPreload from "@koma/ui/assets/logo-1.webp";

const KOMA_FONT_STYLESHEET_URL =
  "https://fonts.googleapis.com/css2?family=Cabin:wght@500;600;700&family=Instrument+Serif:ital@0;1&family=Manrope:wght@400;500;600;700&display=swap";

const playwrightWebAccess =
  import.meta.env.DEV &&
  (import.meta.env.MODE === "e2e" ||
    import.meta.env.VITE_PLAYWRIGHT_WEB_ACCESS === "1");

if (playwrightWebAccess) {
  document.documentElement.dataset.playwrightWebAccess = "enabled";
}

const runWhenIdle = (callback: () => void): void => {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(callback, { timeout: 2_000 });
    return;
  }

  (globalThis as { setTimeout: typeof setTimeout }).setTimeout(callback, 0);
};

const hydrateRuntimeServicesAfterFirstPaint = (): void => {
  runWhenIdle(() => {
    void desktopBridge.hydrateRuntimeConfig()
      .catch(() => undefined)
      .then(() => import("./services/contentCatalog"))
      .then(({ primeRemoteContentCatalog }) => primeRemoteContentCatalog())
      .catch(() => undefined);
  });
};

const appendKomaFontStylesheet = (): void => {
  if (document.querySelector('link[data-koma-fonts="stylesheet"]')) {
    return;
  }

  const fontsOrigin = new URL(KOMA_FONT_STYLESHEET_URL).origin;
  const preconnect = document.createElement("link");
  preconnect.rel = "preconnect";
  preconnect.href = fontsOrigin;
  preconnect.dataset.komaFonts = "preconnect";
  document.head.append(preconnect);

  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = KOMA_FONT_STYLESHEET_URL;
  stylesheet.dataset.komaFonts = "stylesheet";
  document.head.append(stylesheet);
};

const loadFontsAfterFirstPaint = (): void => {
  runWhenIdle(appendKomaFontStylesheet);
};

const preloadCriticalBrandAsset = (): void => {
  if (document.querySelector('link[data-koma-preload="brand-logo"]')) {
    return;
  }

  const preload = document.createElement("link");
  preload.rel = "preload";
  preload.as = "image";
  preload.href = brandLogoPreload;
  preload.setAttribute("fetchpriority", "high");
  preload.dataset.komaPreload = "brand-logo";
  document.head.append(preload);
};

const bootstrap = (): void => {
  preloadCriticalBrandAsset();

  // React 19: render errors are no longer re-thrown — the handler below is
  // the single logging point (the default would be console.error with no prefix).
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement, {
    onUncaughtError: (error, errorInfo) => {
      console.error("[react] uncaught render error:", error, errorInfo.componentStack);
    },
    onCaughtError: (error, errorInfo) => {
      console.error("[react] error caught by boundary:", error, errorInfo.componentStack);
    },
  }).render(
    <React.StrictMode>
      <QueryClientProvider client={appQueryClient}>
        <I18nProvider>
          <App />
        </I18nProvider>
      </QueryClientProvider>
    </React.StrictMode>,
  );

  if (import.meta.env.PROD && !desktopBridge.isDesktopRuntime()) {
    loadFontsAfterFirstPaint();
  } else if (!import.meta.env.PROD) {
    appendKomaFontStylesheet();
  }
  hydrateRuntimeServicesAfterFirstPaint();
};

bootstrap();
