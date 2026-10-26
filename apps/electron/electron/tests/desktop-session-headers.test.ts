import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDesktopSessionHeaders,
  DESKTOP_UPDATE_CHANNEL,
} from "../modules/desktop-session-headers.ts";

test("desktop session headers report the stable channel for prerelease builds", () => {
  const headers = buildDesktopSessionHeaders(
    undefined,
    "access-token",
    { token: "", sessionId: "", deviceId: "" },
    "2.0.0-alpha.3",
  );

  assert.equal(DESKTOP_UPDATE_CHANNEL, "stable");
  assert.equal(headers.get("x-desktop-update-channel"), "stable");
  assert.equal(headers.get("x-desktop-app-version"), "2.0.0-alpha.3");
  assert.equal(headers.get("Authorization"), "Bearer access-token");
});
