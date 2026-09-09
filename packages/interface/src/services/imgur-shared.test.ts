import { test } from "vitest";
import assert from "node:assert/strict";

import {
  calculateImgurRateLimitStatus,
  DEFAULT_IMGUR_CONFIG,
} from "../../../../packages/types/src/imgur.ts";

const now = 1_700_000_000_000;
const oneMinute = 60_000;

test("calculateImgurRateLimitStatus reports zero usage on empty timestamp list", () => {
  assert.deepEqual(
    calculateImgurRateLimitStatus([], DEFAULT_IMGUR_CONFIG.rateLimitPerHour, now),
    {
      limitPerHour: 50,
      usedThisHour: 0,
      remainingThisHour: 50,
      resetsAt: null,
    },
  );
});

test("calculateImgurRateLimitStatus accounts for recent uploads and computes reset time", () => {
  const timestamps = Array.from({ length: 3 }, (_, index) => now - index * oneMinute);
  assert.deepEqual(
    calculateImgurRateLimitStatus(timestamps, DEFAULT_IMGUR_CONFIG.rateLimitPerHour, now),
    {
      limitPerHour: 50,
      usedThisHour: 3,
      remainingThisHour: 47,
      resetsAt: new Date(now + (60 * oneMinute) - (2 * oneMinute)).toISOString(),
    },
  );
});
