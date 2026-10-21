import assert from "node:assert/strict";
import test from "node:test";

import {
  clampDesktopTokenTtlSec,
  clampDesktopTravelDurationDays,
  clampDesktopTravelTokenTtlMinutes,
  invalidateDesktopClientSession,
  isSafeDesktopIdentifier,
  maskEmailAddress,
  normalizeDesktopSlot,
  normalizeDesktopTravelTokenDeliveryMode,
  readDesktopClientSession,
  resolveDesktopSlotDecision,
  upsertDesktopClientSession,
  type DesktopSlotDeviceInput,
} from "../src/services/desktop-session.js";
import { readHeaderValue } from "../src/utils/http.js";

const NOW_MS = 1_700_000_000_000;
const HOUR_MS = 3_600_000;

const device = (
  slot: string | null,
  hwidHmac: string,
  expiresAt: Date | null,
): DesktopSlotDeviceInput => ({ slot, hwidHmac, expiresAt });

const PRIMARY_HMAC = "hmac-primary";
const TRAVEL_HMAC = "hmac-travel";
const OTHER_HMAC = "hmac-other";

test("slot decision: a fresh user (no primary device) registers on the primary slot", () => {
  const decision = resolveDesktopSlotDecision({
    primaryDevice: null,
    travelDevice: null,
    deviceHmac: OTHER_HMAC,
    nowMs: NOW_MS,
    hasProvidedTravelToken: false,
    disableTravelTokenEnforcement: false,
  });

  assert.deepEqual(decision, { action: "register-primary" });
});

test("slot decision: the same hardware re-claims its primary slot", () => {
  const decision = resolveDesktopSlotDecision({
    primaryDevice: device("primary", PRIMARY_HMAC, null),
    travelDevice: null,
    deviceHmac: PRIMARY_HMAC,
    nowMs: NOW_MS,
    hasProvidedTravelToken: false,
    disableTravelTokenEnforcement: false,
  });

  assert.deepEqual(decision, { action: "register-primary" });
});

test("slot decision: an active travel device with the same hwid reuses its expiry", () => {
  const expiresAt = new Date(NOW_MS + 24 * HOUR_MS);
  const decision = resolveDesktopSlotDecision({
    primaryDevice: device("primary", PRIMARY_HMAC, null),
    travelDevice: device("travel", TRAVEL_HMAC, expiresAt),
    deviceHmac: TRAVEL_HMAC,
    nowMs: NOW_MS,
    hasProvidedTravelToken: false,
    disableTravelTokenEnforcement: false,
  });

  assert.deepEqual(decision, { action: "register-travel-reuse", travelExpiresAt: expiresAt });
});

test("slot decision: an expired travel device does not reuse (travel busy without a token)", () => {
  const decision = resolveDesktopSlotDecision({
    primaryDevice: device("primary", PRIMARY_HMAC, null),
    travelDevice: device("travel", TRAVEL_HMAC, new Date(NOW_MS - HOUR_MS)),
    deviceHmac: TRAVEL_HMAC,
    nowMs: NOW_MS,
    hasProvidedTravelToken: false,
    disableTravelTokenEnforcement: false,
  });

  assert.deepEqual(decision, { action: "deny-travel-token-required" });
});

test("slot decision: a different hwid without a travel token is denied", () => {
  const decision = resolveDesktopSlotDecision({
    primaryDevice: device("primary", PRIMARY_HMAC, null),
    travelDevice: null,
    deviceHmac: OTHER_HMAC,
    nowMs: NOW_MS,
    hasProvidedTravelToken: false,
    disableTravelTokenEnforcement: false,
  });

  assert.deepEqual(decision, { action: "deny-travel-token-required" });
});

test("slot decision: a provided travel token moves to the consume transition", () => {
  const decision = resolveDesktopSlotDecision({
    primaryDevice: device("primary", PRIMARY_HMAC, null),
    travelDevice: null,
    deviceHmac: OTHER_HMAC,
    nowMs: NOW_MS,
    hasProvidedTravelToken: true,
    disableTravelTokenEnforcement: false,
  });

  assert.deepEqual(decision, { action: "consume-travel-token" });
});

test("slot decision: disabled travel-token enforcement lands on the primary slot", () => {
  const decision = resolveDesktopSlotDecision({
    primaryDevice: device("primary", PRIMARY_HMAC, null),
    travelDevice: null,
    deviceHmac: OTHER_HMAC,
    nowMs: NOW_MS,
    hasProvidedTravelToken: false,
    disableTravelTokenEnforcement: true,
  });

  assert.deepEqual(decision, { action: "register-primary" });
});

test("token TTL clamps to the 300..900 seconds band with the fallback", () => {
  assert.equal(clampDesktopTokenTtlSec(undefined, 600), 600);
  assert.equal(clampDesktopTokenTtlSec(1, 600), 300);
  assert.equal(clampDesktopTokenTtlSec("not-a-number", 600), 600);
  assert.equal(clampDesktopTokenTtlSec(999_999, 600), 900);
  assert.equal(clampDesktopTokenTtlSec(450, 600), 450);
});

test("travel token TTL clamps to the 5..180 minutes band", () => {
  assert.equal(clampDesktopTravelTokenTtlMinutes(undefined, 30), 30);
  assert.equal(clampDesktopTravelTokenTtlMinutes(1, 30), 5);
  assert.equal(clampDesktopTravelTokenTtlMinutes(10_000, 30), 180);
});

test("travel duration days clamps to the 1..60 band", () => {
  assert.equal(clampDesktopTravelDurationDays(undefined, 7), 7);
  // Non-positive / non-integer values fall back BEFORE the band clamp; the
  // fallback itself is still band-clamped (a 0 fallback clamps up to 1).
  assert.equal(clampDesktopTravelDurationDays(0, 7), 7);
  assert.equal(clampDesktopTravelDurationDays(0, 0), 1);
  assert.equal(clampDesktopTravelDurationDays(365, 7), 60);
});

test("normalizeDesktopSlot accepts only the canonical slot names", () => {
  assert.equal(normalizeDesktopSlot("primary"), "primary");
  assert.equal(normalizeDesktopSlot("travel"), "travel");
  assert.equal(normalizeDesktopSlot("other"), null);
  assert.equal(normalizeDesktopSlot(null), null);
  assert.equal(normalizeDesktopSlot(undefined), null);
});

test("travel token delivery mode normalizes to copy unless email", () => {
  assert.equal(normalizeDesktopTravelTokenDeliveryMode("email"), "email");
  assert.equal(normalizeDesktopTravelTokenDeliveryMode("copy"), "copy");
  assert.equal(normalizeDesktopTravelTokenDeliveryMode(undefined), "copy");
  assert.equal(normalizeDesktopTravelTokenDeliveryMode(42), "copy");
});

test("safe desktop identifiers allow the documented charset and length", () => {
  assert.equal(isSafeDesktopIdentifier("hw-1234567890"), true);
  assert.equal(isSafeDesktopIdentifier("a".repeat(128)), true);
  assert.equal(isSafeDesktopIdentifier("short"), false);
  assert.equal(isSafeDesktopIdentifier("has spaces here"), false);
});

test("maskEmailAddress masks the local part and preserves the domain", () => {
  assert.equal(maskEmailAddress("reader@example.com"), "re****@example.com");
  assert.equal(maskEmailAddress("a@b.com"), "a*@b.com");
  assert.equal(maskEmailAddress("not-an-email"), "not-an-email");
});

test("readHeaderValue reads the first header value and trims it", () => {
  assert.equal(readHeaderValue(" token "), "token");
  assert.equal(readHeaderValue(["first", "second"]), "first");
  assert.equal(readHeaderValue("   "), null);
  assert.equal(readHeaderValue(undefined), null);
});

test("session upsert/read validates the device and the current token", () => {
  const token = "a".repeat(43);
  upsertDesktopClientSession({
    sessionId: "sess-1",
    deviceId: "device-1",
    userId: "user-1",
    token,
    ttlSeconds: 600,
    refreshSkewSec: 30,
    nowMs: NOW_MS,
  });

  assert.equal(
    readDesktopClientSession({
      sessionId: "sess-1",
      deviceId: "device-1",
      token,
      nowMs: NOW_MS + 1,
    }).ok,
    true,
  );
  assert.equal(
    readDesktopClientSession({
      sessionId: "sess-1",
      deviceId: "device-2",
      token,
      nowMs: NOW_MS + 1,
    }).ok,
    false,
  );
  assert.equal(
    readDesktopClientSession({
      sessionId: "sess-1",
      deviceId: "device-1",
      token: "b".repeat(43),
      nowMs: NOW_MS + 1,
    }).ok,
    false,
  );
  invalidateDesktopClientSession("sess-1");
});

test("session read accepts the previous token inside the refresh skew only", () => {
  const firstToken = "a".repeat(43);
  const secondToken = "b".repeat(43);
  const base = {
    sessionId: "sess-2",
    deviceId: "device-1",
    userId: "user-1",
    ttlSeconds: 600,
    refreshSkewSec: 30,
  };
  upsertDesktopClientSession({ ...base, token: firstToken, nowMs: NOW_MS });
  upsertDesktopClientSession({ ...base, token: secondToken, nowMs: NOW_MS });

  assert.equal(
    readDesktopClientSession({
      sessionId: "sess-2",
      deviceId: "device-1",
      token: firstToken,
      nowMs: NOW_MS + 1_000,
    }).ok,
    true,
  );
  assert.equal(
    readDesktopClientSession({
      sessionId: "sess-2",
      deviceId: "device-1",
      token: firstToken,
      nowMs: NOW_MS + 31_000,
    }).ok,
    false,
  );
  assert.equal(
    readDesktopClientSession({
      sessionId: "sess-2",
      deviceId: "device-1",
      token: secondToken,
      nowMs: NOW_MS + 31_000,
    }).ok,
    true,
  );
  invalidateDesktopClientSession("sess-2");
});

test("expired sessions are rejected and removed", () => {
  const token = "a".repeat(43);
  upsertDesktopClientSession({
    sessionId: "sess-3",
    deviceId: "device-1",
    userId: null,
    token,
    ttlSeconds: 300,
    refreshSkewSec: 30,
    nowMs: NOW_MS,
  });

  assert.equal(
    readDesktopClientSession({
      sessionId: "sess-3",
      deviceId: "device-1",
      token,
      nowMs: NOW_MS + 300_000,
    }).ok,
    false,
  );
  assert.equal(
    readDesktopClientSession({
      sessionId: "sess-3",
      deviceId: "device-1",
      token,
      nowMs: NOW_MS + 300_001,
    }).ok,
    false,
  );
});
