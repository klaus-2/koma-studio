import assert from "node:assert/strict";
import { mock, test } from "node:test";

import { redisClient } from "../src/services/redis.ts";
import { isTokenRevoked, isUserTokenRevoked } from "../src/services/token-blocklist.ts";
import { logger } from "../src/utils/logger.ts";

const notReady = () => {
  const isReadyDescriptor = Object.getOwnPropertyDescriptor(redisClient, "isReady");
  Object.defineProperty(redisClient, "isReady", { configurable: true, get: () => false });

  const connect = mock.method(redisClient, "connect", async (): Promise<never> => {
    throw new Error("unit tests must not open a Redis connection");
  });
  const warn = mock.method(logger, "warn", (): void => {});

  const restore = (): void => {
    connect.mock.restore();
    warn.mock.restore();
    if (isReadyDescriptor) {
      Object.defineProperty(redisClient, "isReady", isReadyDescriptor);
    } else {
      Reflect.deleteProperty(redisClient, "isReady");
    }
  };
  return { connect, warn, restore };
};

test("session revocation fails open while Redis is not ready, and never connects", async () => {
  const { connect, warn, restore } = notReady();
  try {
    const results = await Promise.all(
      Array.from({ length: 20 }, (_unused, index) => isTokenRevoked(`session-${index}`)),
    );

    assert.deepEqual([...new Set(results)], [false], "must fail open, not closed");
    assert.equal(connect.mock.callCount(), 0, "a unit test must not open a Redis connection");
    assert.equal(warn.mock.callCount(), 1, "concurrent checks must log once");
    assert.equal(
      warn.mock.calls[0].arguments[1]?.reason,
      "token-check-unavailable",
      "the log must name the reason",
    );
  } finally {
    restore();
  }
});

test("a different fail-open reason gets its own log slot", async () => {
  const { connect, warn, restore } = notReady();
  try {
    const results = await Promise.all(
      Array.from({ length: 20 }, (_unused, index) => isUserTokenRevoked(`user-${index}`)),
    );

    assert.deepEqual([...new Set(results)], [false], "must fail open, not closed");
    assert.equal(connect.mock.callCount(), 0, "a unit test must not open a Redis connection");
    assert.equal(warn.mock.callCount(), 1, "the second reason must not be crowded out");
    assert.equal(
      warn.mock.calls[0].arguments[1]?.reason,
      "user-token-check-unavailable",
      "the log must name the reason",
    );
  } finally {
    restore();
  }
});
