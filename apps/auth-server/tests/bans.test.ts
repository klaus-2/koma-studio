import assert from "node:assert/strict";
import test from "node:test";

import {
  banMatchesSignals,
  collectBanTargetHashes,
  getBanPresentation,
  isBanActive,
  type BanCheckSignals,
} from "../src/services/bans.ts";

const baseSignals: BanCheckSignals = {
  userId: "user_123",
  desktopHwidHmac: "hwid_hash_123",
  desktopMacHmac: "mac_hash_123",
  ipSubnetHmac: "ip_hash_123",
};

test("collectBanTargetHashes builds presets from available registration identities", () => {
  const targets = collectBanTargetHashes(
    "account_hwid_mac_ip",
    "user_123",
    [
      { identityType: "desktop_hwid", identityHash: "hwid_hash_123" },
      { identityType: "desktop_mac", identityHash: "mac_hash_123" },
      { identityType: "ip_subnet", identityHash: "ip_hash_123" },
    ],
  );

  assert.deepEqual(
    targets.map((item) => ({ type: item.targetType, hash: item.targetHash })),
    [
      { type: "account", hash: "user_123" },
      { type: "desktop_hwid", hash: "hwid_hash_123" },
      { type: "desktop_mac", hash: "mac_hash_123" },
      { type: "ip_subnet", hash: "ip_hash_123" },
    ],
  );
});

test("banMatchesSignals matches account and device scopes", () => {
  assert.equal(
    banMatchesSignals(
      { targetType: "account", targetHash: "user_123" },
      baseSignals,
    ),
    true,
  );
  assert.equal(
    banMatchesSignals(
      { targetType: "desktop_hwid", targetHash: "hwid_hash_123" },
      baseSignals,
    ),
    true,
  );
  assert.equal(
    banMatchesSignals(
      { targetType: "desktop_mac", targetHash: "different" },
      baseSignals,
    ),
    false,
  );
});

test("isBanActive respects startsAt, expiresAt and liftedAt", () => {
  const now = new Date("2026-03-10T12:00:00.000Z");

  assert.equal(isBanActive({ startsAt: new Date("2026-03-10T10:00:00.000Z"), expiresAt: null, liftedAt: null }, now), true);
  assert.equal(isBanActive({ startsAt: new Date("2026-03-10T13:00:00.000Z"), expiresAt: null, liftedAt: null }, now), false);
  assert.equal(isBanActive({ startsAt: null, expiresAt: new Date("2026-03-10T11:00:00.000Z"), liftedAt: null }, now), false);
  assert.equal(isBanActive({ startsAt: null, expiresAt: null, liftedAt: new Date("2026-03-10T11:30:00.000Z") }, now), false);
});

test("getBanPresentation returns stable user-facing labels", () => {
  const permanent = getBanPresentation({
    reason: "Confirmed malicious links",
    expiresAt: null,
    scope: "account_hwid_mac_ip",
  });
  assert.equal(permanent.title, "Access blocked");
  assert.equal(permanent.temporary, false);

  const temporary = getBanPresentation({
    reason: "Repeated spam",
    expiresAt: new Date("2026-04-01T00:00:00.000Z"),
    scope: "account_only",
  });
  assert.equal(temporary.temporary, true);
  assert.match(temporary.detail, /Repeated spam/);
});
