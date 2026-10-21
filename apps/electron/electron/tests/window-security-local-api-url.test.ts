import test from "node:test";
import assert from "node:assert/strict";

import { shouldAttachLocalSessionHeader } from "../modules/window-security-headers.ts";

test("local session header decision follows the getter's CURRENT origin per request", () => {
  let localApiUrl = "http://127.0.0.1:8765";
  const getLocalApiUrl = (): string => localApiUrl;

  const requestAtA = "http://127.0.0.1:8765/api/health";
  const requestAtB = "http://127.0.0.1:9999/api/health";

  // While the getter still returns origin A: a URL at A attaches, B does not.
  assert.equal(shouldAttachLocalSessionHeader(requestAtA, getLocalApiUrl()), true);
  assert.equal(shouldAttachLocalSessionHeader(requestAtB, getLocalApiUrl()), false);

  localApiUrl = "http://127.0.0.1:9999";
  assert.equal(shouldAttachLocalSessionHeader(requestAtB, getLocalApiUrl()), true);
  assert.equal(shouldAttachLocalSessionHeader(requestAtA, getLocalApiUrl()), false);
});

test("local session header is not attached for malformed inputs", () => {
  assert.equal(
    shouldAttachLocalSessionHeader("not-a-url", "http://127.0.0.1:8765"),
    false,
  );
  assert.equal(
    shouldAttachLocalSessionHeader("http://127.0.0.1:8765/api", "not-a-url"),
    false,
  );
});
