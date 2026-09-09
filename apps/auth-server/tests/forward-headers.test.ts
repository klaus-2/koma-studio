import assert from "node:assert/strict";
import test from "node:test";

import { buildAuthForwardHeaders } from "../src/auth/forward-headers.ts";

test("buildAuthForwardHeaders strips sensitive auth and desktop headers", () => {
  const headers = buildAuthForwardHeaders({
    authorization: "Bearer secret-token",
    cookie: "session=abc123",
    origin: "https://app.koma.example",
    "user-agent": "KomaStudioDesktop/1.0",
    "accept-language": "pt-BR,pt;q=0.9",
    "cf-connecting-ip": "1.1.1.1",
    "x-real-ip": "2.2.2.2",
    "x-forwarded-for": "3.3.3.3, 4.4.4.4",
    "x-desktop-client-token": "desktop-client-token",
    "x-desktop-session-id": "desktop-session-id",
    "x-desktop-device-id": "desktop-device-id",
    "x-desktop-bootstrap-secret": "bootstrap-secret",
    "x-desktop-device-key": "desktop-device-key",
    "x-desktop-travel-token": "travel-token",
    "x-forwarded-host": "proxy.example",
  });

  assert.equal(headers.get("authorization"), null);
  assert.equal(headers.get("cookie"), null);
  assert.equal(headers.get("x-desktop-client-token"), null);
  assert.equal(headers.get("x-desktop-session-id"), null);
  assert.equal(headers.get("x-desktop-device-id"), null);
  assert.equal(headers.get("x-desktop-bootstrap-secret"), null);
  assert.equal(headers.get("x-desktop-device-key"), null);
  assert.equal(headers.get("x-desktop-travel-token"), null);
  assert.equal(headers.get("x-forwarded-host"), null);

  assert.equal(headers.get("origin"), "https://app.koma.example");
  assert.equal(headers.get("user-agent"), "KomaStudioDesktop/1.0");
  assert.equal(headers.get("accept-language"), "pt-BR,pt;q=0.9");
  assert.equal(headers.get("cf-connecting-ip"), "1.1.1.1");
  assert.equal(headers.get("x-real-ip"), "2.2.2.2");
  assert.equal(headers.get("x-forwarded-for"), "3.3.3.3, 4.4.4.4");
});

test("buildAuthForwardHeaders only includes cookies when explicitly requested", () => {
  const withoutCookie = buildAuthForwardHeaders({
    cookie: "session=abc123",
    origin: "https://app.koma.example",
  });
  const withCookie = buildAuthForwardHeaders(
    {
      cookie: "session=abc123",
      origin: "https://app.koma.example",
    },
    {
      includeCookie: true,
    },
  );

  assert.equal(withoutCookie.get("cookie"), null);
  assert.equal(withCookie.get("cookie"), "session=abc123");
  assert.equal(withCookie.get("origin"), "https://app.koma.example");
});
