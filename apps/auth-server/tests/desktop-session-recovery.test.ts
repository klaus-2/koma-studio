import assert from "node:assert/strict";
import test from "node:test";

import { resolveDesktopSessionRecoveryAction } from "@koma/types/desktopSessionRecovery";

test("refreshes the desktop session when auth-server reports an invalid desktop session code", () => {
  const action = resolveDesktopSessionRecoveryAction(403, {
    error: "Desktop session invalid or expired.",
    code: "DESKTOP_CLIENT_SESSION_INVALID",
  });

  assert.equal(action, "refresh-session");
});

test("refreshes the desktop session when backend responses only preserve the message", () => {
  const action = resolveDesktopSessionRecoveryAction(403, {
    detail: "Desktop session invalid or expired.",
  });

  assert.equal(action, "refresh-session");
});

test("re-registers the device when the desktop device key is no longer valid", () => {
  const action = resolveDesktopSessionRecoveryAction(401, {
    error: "Invalid desktop device credential.",
    code: "DESKTOP_DEVICE_KEY_INVALID",
  });

  assert.equal(action, "refresh-device");
});

test("does not retry unrelated auth failures", () => {
  const action = resolveDesktopSessionRecoveryAction(401, {
    error: "Invalid token",
    code: "AUTH_INVALID_TOKEN",
  });

  assert.equal(action, null);
});

// The canonical classifier in @koma/types is bilingual (EN + legacy v1 PT
// server messages). The drifted vendored copy was EN-only — these cases pin
// the PT patterns arriving at the server UNCHANGED through the canonical
// import.
test("refreshes the desktop session from the legacy PT session message (bilingual canonical)", () => {
  const action = resolveDesktopSessionRecoveryAction(403, {
    error: "Sessão desktop inválida ou expirada.",
  });

  assert.equal(action, "refresh-session");
});

test("re-registers the device from the legacy PT device message (bilingual canonical)", () => {
  const action = resolveDesktopSessionRecoveryAction(401, {
    error: "Dispositivo desktop não registrado.",
  });

  assert.equal(action, "refresh-device");
});
