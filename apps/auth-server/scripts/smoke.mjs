import { createHash } from "node:crypto";

const baseUrl = process.env.AUTH_SERVER_URL ?? "http://localhost:3001";

const email = process.env.SMOKE_EMAIL ?? "measure-user@koma.local";
const password = process.env.SMOKE_PASSWORD ?? `smoke-${createHash("sha256").update(`pw:${email}`).digest("hex")}`;
const enforceDesktopRegistration = ["1", "true", "yes"].includes(
  (process.env.ENFORCE_DESKTOP_REGISTRATION ?? "").trim().toLowerCase(),
);
const desktopDeviceId =
  process.env.SMOKE_DESKTOP_DEVICE_ID ??
  `hwid-smoke-${createHash("sha256").update(`device:${email}`).digest("hex")}`;
const desktopMacFingerprint =
  process.env.SMOKE_DESKTOP_MAC_FINGERPRINT ??
  `macf-${createHash("sha256").update(`mac:${email}`).digest("hex").slice(0, 64)}`;

let cookieHeader = "";

const mergeCookies = (response) => {
  const getSetCookie = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
  const setCookie = Array.isArray(getSetCookie) ? getSetCookie : [];
  if (setCookie.length === 0) {
    return;
  }

  const pairs = setCookie
    .map((entry) => entry.split(";")[0])
    .filter((entry) => entry.length > 0);

  const existing = cookieHeader
    .split(";")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  const map = new Map();
  for (const cookie of [...existing, ...pairs]) {
    const [key, value] = cookie.split("=");
    if (key && value) {
      map.set(key, value);
    }
  }

  cookieHeader = Array.from(map.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
};

const call = async (path, init = {}) => {
  const headers = new Headers(init.headers ?? {});
  headers.set("x-desktop-app-version", "2.0.0");
  if (cookieHeader) {
    headers.set("cookie", cookieHeader);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  });

  mergeCookies(response);
  return response;
};

const assertOk = async (label, response) => {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    console.error(`${label} failed`, response.status, body);
    process.exit(1);
  }
  console.log(`${label} ok`);
  return body;
};

const run = async () => {
  const healthResponse = await call("/health");
  await assertOk("health", healthResponse);

  // Try login first; register only if the user does not exist yet.
  const loginResponse = await call("/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-desktop-app-version": "2.0.0",
    },
    body: JSON.stringify({
      email,
      password,
      desktopDeviceId:
        process.env.SMOKE_DESKTOP_DEVICE_ID ?? "hwid-measure-2026",
      desktopAppVersion: "2.0.0",
    }),
  });
  if (!loginResponse.ok) {
    console.log(`login failed (${loginResponse.status}); registering new user...`);
    await call("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        name: "Measure User",
        legalAcceptance: {
          termsAccepted: true,
          privacyAccepted: true,
          termsVersion: "2026.07.01",
          privacyVersion: "2026.07.01",
        },
      }),
    });
    const reLogin = await call("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    await assertOk("login", reLogin);
  } else {
    console.log("login ok (existing user)");
  }

  const sessionResponse = await call("/api/auth/session", {
    method: "GET",
  });
  const sessionPayload = await assertOk("session", sessionResponse);

  const accessToken = sessionPayload?.accessToken;
  if (!accessToken) {
    console.error("session returned without accessToken");
    process.exit(1);
  }

  const verifyResponse = await call("/api/auth/verify", {
    method: "GET",
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
  await assertOk("verify", verifyResponse);

  const usageResponse = await call("/api/usage/me", {
    method: "GET",
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
  await assertOk("usage", usageResponse);

  const logoutResponse = await call("/api/auth/sign-out", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:5173",
    },
    body: JSON.stringify({}),
  });
  await assertOk("sign-out", logoutResponse);

  console.log("smoke test completed");
};

run().catch((error) => {
  console.error("smoke test failed", error);
  process.exit(1);
});
