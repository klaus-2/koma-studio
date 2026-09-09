/**
 * Routes desktop deep links (komastudio://...) into the SPA hash router.
 *
 * Two delivery paths, both required:
 *  - `getCurrent` — cold start: the deep-link plugin captured the launch URL
 *    from argv at Rust startup, before the webview existed to hear the event.
 *  - `onOpenUrl` — warm start: a second process launched by the OS protocol
 *    handler was collapsed by the single-instance plugin, which forwarded its
 *    argv to this instance as a `deep-link://new-url` event.
 *
 * URL → route conversion is delegated to the Rust `deepLinkRoute` command so
 * the normalization quirks (komastudio:/ vs komastudio://, percent-encoding)
 * live in one tested place. Setting location.hash (not window.navigate) keeps
 * the SPA state intact — the existing hashchange listener in App.tsx applies
 * the route, auth gates included.
 */
import { useEffect } from "react";

import { desktopBridge } from "@/lib/desktop-bridge";

const firstUrl = (value: string | string[] | null | undefined): string | null => {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
};

export const applyDeepLinkHash = (hashRoute: string): void => {
  const normalized = hashRoute.startsWith("/") ? hashRoute : `/${hashRoute}`;
  if (window.location.hash === `#${normalized}`) {
    return;
  }
  window.location.hash = normalized;
};

export const useDesktopDeepLink = (): void => {
  useEffect(() => {
    if (!desktopBridge.isDesktopRuntime()) {
      return;
    }

    let disposed = false;
    const apply = (url: string | null): void => {
      if (!url) {
        return;
      }
      desktopBridge.desktop?.api?.integrations
        .deepLinkRoute({ url })
        .then((hashRoute) => {
          if (!disposed && hashRoute) {
            applyDeepLinkHash(hashRoute);
          }
        })
        .catch((error: unknown) => {
          console.warn("[deep-link] failed to route", url, error);
        });
    };

    void desktopBridge
      .getLaunchUrl?.()
      .then((value) => apply(firstUrl(value)))
      .catch((error: unknown) => {
        console.warn("[deep-link] failed to read launch link", error);
      });
    const unsubscribe = desktopBridge.onOpenUrl?.((urls) => apply(firstUrl(urls)));

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, []);
};
