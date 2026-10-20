/**
 * Internal app:// protocol handler + asset path resolution.
 */
import { net as electronNet, protocol } from "electron";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { INTERNAL_APP_HOST, INTERNAL_APP_PROTOCOL } from "./app-protocols.ts";

const resolveAppProtocolAssetPath = (requestPathname: string): string | null => {
  const distRoot = path.resolve(__dirname, "../dist");
  const decodedPathname = (() => {
    try {
      return decodeURIComponent(requestPathname);
    } catch {
      return requestPathname;
    }
  })();
  const sanitizedPathname = decodedPathname.replace(/\\/g, "/");
  const requestedRelativePath =
    sanitizedPathname === "/" ? "index.html" : sanitizedPathname.replace(/^\/+/, "");
  const candidatePath = path.normalize(path.join(distRoot, requestedRelativePath));

  if (!candidatePath.startsWith(distRoot)) {
    return null;
  }

  if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
    return candidatePath;
  }

  // SPA fallback for app://local/<route> links.
  if (!path.extname(requestedRelativePath)) {
    const indexPath = path.join(distRoot, "index.html");
    if (fs.existsSync(indexPath)) {
      return indexPath;
    }
  }

  return null;
};

const setupInternalAppProtocol = (isDev: boolean): void => {
  if (isDev) {
    return;
  }

  protocol.handle(INTERNAL_APP_PROTOCOL, async (request) => {
    try {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Method Not Allowed", { status: 405 });
      }

      const parsed = new URL(request.url);
      if (parsed.hostname !== INTERNAL_APP_HOST) {
        return new Response("Not Found", { status: 404 });
      }

      const assetPath = resolveAppProtocolAssetPath(parsed.pathname);
      if (!assetPath) {
        return new Response("Not Found", { status: 404 });
      }

      const response = await electronNet.fetch(pathToFileURL(assetPath).toString());

      // Inject CSP headers for HTML responses so Turnstile and other
      // external resources work correctly in the packaged app.
      if (assetPath.endsWith(".html")) {
        const headers = new Headers(response.headers);
        headers.set(
          "Content-Security-Policy",
          "default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self' https://challenges.cloudflare.com; frame-src 'self' https://challenges.cloudflare.com; worker-src 'self' blob: https://challenges.cloudflare.com; connect-src 'self' https: wss: http://127.0.0.1:* ws://127.0.0.1:* http://localhost:* ws://localhost:*; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src-attr 'unsafe-inline'; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; form-action 'self' https://*.stripe.com https://*.mercadopago.com https://*.mercadopago.com.br;",
        );
        headers.set("X-Frame-Options", "DENY");
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      }

      return response;
    } catch {
      return new Response("Bad Request", { status: 400 });
    }
  });
};

export { resolveAppProtocolAssetPath, setupInternalAppProtocol };
