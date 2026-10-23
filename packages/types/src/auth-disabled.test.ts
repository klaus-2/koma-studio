import test from "node:test";
import assert from "node:assert/strict";

import { isAuthDisabledFlag } from "./auth-disabled.ts";

test("an explicit value wins over the environment default", () => {
  for (const raw of ["true", "1", "yes", " TRUE ", "Yes"]) {
    assert.equal(isAuthDisabledFlag(raw, false), true, raw);
  }
  for (const raw of ["false", "0", "no", " FALSE ", "No"]) {
    assert.equal(isAuthDisabledFlag(raw, true), false, raw);
  }
});

test("an unset flag follows the caller's default", () => {
  assert.equal(isAuthDisabledFlag(undefined, true), true);
  assert.equal(isAuthDisabledFlag("", false), false);
  assert.equal(isAuthDisabledFlag("   ", true), true);
});

test("an unreadable value keeps the caller's default", () => {
  assert.equal(isAuthDisabledFlag("maybe", true), true);
  assert.equal(isAuthDisabledFlag("maybe", false), false);
});
