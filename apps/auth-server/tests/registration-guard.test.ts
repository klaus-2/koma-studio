import assert from "node:assert/strict";
import test from "node:test";

import type { Request } from "express";

import {
  assertRegistrationAllowed,
  computeRegistrationIdentityHmac,
  extractDesktopRegistrationSignals,
  isRegistrationIdentityConflictError,
  isSafeDesktopDeviceId,
  isSafeDesktopMacFingerprint,
  normalizeIpSubnet,
  persistRegistrationIdentity,
  RegistrationIdentityConflictError,
} from "../src/security/registration-guard.ts";

// Contract of the open-source build: device-fingerprint identity collection
// is intentionally disabled (see registration-guard.ts). Routes/auth.ts only
// rejects registrations when ENFORCE_DESKTOP_REGISTRATION is on, so this
// guard must stay a safe no-op: extraction reports "missing", hashes are
// empty, and nothing is ever persisted. These tests pin that contract — if
// they ever fail, identity collection is being reintroduced.

const makeRequest = (ip: string): Request =>
  ({
    headers: {},
    ip,
    socket: {
      remoteAddress: ip,
    },
  } as unknown as Request);

test("normalizeIpSubnet is a no-op returning null", () => {
  assert.equal(normalizeIpSubnet("192.168.10.44"), null);
  assert.equal(normalizeIpSubnet("::ffff:203.0.113.21"), null);
  assert.equal(normalizeIpSubnet("not-an-ip"), null);
});

test("desktop identity validators accept everything (no format enforcement)", () => {
  assert.equal(isSafeDesktopDeviceId("hwid-smoke-test-12345"), true);
  assert.equal(isSafeDesktopDeviceId("bad id with spaces"), true);

  assert.equal(isSafeDesktopMacFingerprint(`macf-${"a".repeat(64)}`), true);
  assert.equal(isSafeDesktopMacFingerprint("macf-invalid"), true);
});

test("computeRegistrationIdentityHmac returns an empty string", () => {
  assert.equal(computeRegistrationIdentityHmac("desktop_hwid", "anything"), "");
  assert.equal(computeRegistrationIdentityHmac("ip_subnet", "10.0.0.0/24"), "");
});

test("extractDesktopRegistrationSignals always reports missing", () => {
  const withBody = extractDesktopRegistrationSignals(makeRequest("::ffff:198.51.100.89"), {
    desktopDeviceId: "hwid-smoke-test-12345",
    desktopMacFingerprint: `macf-${"b".repeat(64)}`,
  });
  assert.equal(withBody.ok, false);
  if (!withBody.ok) {
    assert.equal(withBody.error, "missing");
  }

  const empty = extractDesktopRegistrationSignals(makeRequest("203.0.113.10"), {});
  assert.equal(empty.ok, false);
  if (!empty.ok) {
    assert.equal(empty.error, "missing");
  }
});

test("registration is always allowed and nothing is persisted", async () => {
  const hashes = {
    desktopHwidHmac: "",
    desktopMacHmac: "",
    ipSubnetHmac: "",
  };

  assert.deepEqual(await assertRegistrationAllowed(hashes), { allowed: true });
  assert.equal(await persistRegistrationIdentity("user-1", hashes), undefined);
});

test("conflict error keeps its shape for callers that still branch on it", () => {
  const error = new RegistrationIdentityConflictError("desktop_hwid");
  assert.equal(error.name, "RegistrationIdentityConflictError");
  assert.equal(error.signal, "desktop_hwid");
  assert.equal(isRegistrationIdentityConflictError(error), true);
  assert.equal(isRegistrationIdentityConflictError(new Error("other")), false);
});
