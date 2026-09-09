import assert from "node:assert/strict";
import test from "node:test";

import { parseLegalAcceptancePayload } from "../src/legal/acceptance.ts";

test("parseLegalAcceptancePayload accepts valid consent payloads", () => {
  const result = parseLegalAcceptancePayload({
    termsAccepted: true,
    privacyAccepted: true,
    termsVersion: "2026-03-10",
    privacyVersion: "2026-03-10",
    cookiesVersion: "2026-03-10",
    contentVersion: "2026-03-10",
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.deepEqual(result.value, {
    termsVersion: "2026-03-10",
    privacyVersion: "2026-03-10",
    cookiesVersion: "2026-03-10",
    contentVersion: "2026-03-10",
  });
});

test("parseLegalAcceptancePayload rejects missing mandatory acceptance", () => {
  const result = parseLegalAcceptancePayload(
    {
      termsAccepted: false,
      privacyAccepted: true,
      termsVersion: "2026-03-10",
      privacyVersion: "2026-03-10",
    },
    "pt-br",
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /aceitar os Termos/i);
  }
});

test("parseLegalAcceptancePayload rejects malformed versions", () => {
  const result = parseLegalAcceptancePayload(
    {
      termsAccepted: true,
      privacyAccepted: true,
      termsVersion: "2026/03/10",
      privacyVersion: "",
    },
    "pt-br",
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /vers[aã]o dos documentos legais/i);
  }
});
