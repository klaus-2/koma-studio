import assert from "node:assert/strict";
import test from "node:test";

import {
  SENSITIVE_RESPONSE_VARY_HEADERS,
  applySensitiveResponseHeaders,
} from "../src/security/response-headers.ts";

interface MockResponseHeaders {
  getHeader: (name: string) => string | undefined;
  setHeader: (name: string, value: string) => void;
}

const createMockResponse = (): MockResponseHeaders & { headers: Map<string, string> } => {
  const headers = new Map<string, string>();

  return {
    headers,
    getHeader: (name: string) => headers.get(name.toLowerCase()),
    setHeader: (name: string, value: string) => {
      headers.set(name.toLowerCase(), value);
    },
  };
};

test("applySensitiveResponseHeaders sets no-store directives and merges vary safely", () => {
  const response = createMockResponse();
  response.setHeader("vary", "Accept-Encoding, Origin");

  applySensitiveResponseHeaders(response);

  assert.equal(response.getHeader("cache-control"), "no-store, max-age=0");
  assert.equal(response.getHeader("pragma"), "no-cache");
  assert.equal(response.getHeader("expires"), "0");

  const vary = response.getHeader("vary");
  assert.ok(vary);
  assert.match(vary, /Accept-Encoding/);

  for (const header of SENSITIVE_RESPONSE_VARY_HEADERS) {
    assert.match(vary, new RegExp(header));
  }

  const originMatches = vary.match(/Origin/g) ?? [];
  assert.equal(originMatches.length, 1);
});
