import assert from "node:assert/strict";
import { mock, test } from "node:test";

import {
  clearFailedLoginAttempts,
  getFailedLoginAttempts,
  increaseFailedLoginAttempts,
} from "../src/security/anomaly.ts";
import { redisClient } from "../src/services/redis.ts";

const withoutRedis = () => {
  const isReadyDescriptor = Object.getOwnPropertyDescriptor(redisClient, "isReady");
  Object.defineProperty(redisClient, "isReady", { configurable: true, get: () => false });

  const connect = mock.method(redisClient, "connect", async (): Promise<never> => {
    throw new Error("unit tests must not open a Redis connection");
  });

  const restore = (): void => {
    connect.mock.restore();
    if (isReadyDescriptor) {
      Object.defineProperty(redisClient, "isReady", isReadyDescriptor);
    } else {
      Reflect.deleteProperty(redisClient, "isReady");
    }
  };

  return { connect, restore };
};

test("failed login attempts are counted while Redis is not ready", async () => {
  const { connect, restore } = withoutRedis();
  const email = "count@example.com";
  const ip = "203.0.113.10";

  try {
    await clearFailedLoginAttempts(email, ip);

    const first = await increaseFailedLoginAttempts(email, ip);
    const second = await increaseFailedLoginAttempts(email, ip);

    assert.equal(first.account, 1);
    assert.equal(second.account, 2);
    assert.equal(await getFailedLoginAttempts(email, ip), 2);
    assert.equal(connect.mock.callCount(), 0, "a unit test must not open a Redis connection");
  } finally {
    restore();
  }
});

test("clearing failed login attempts resets the counter while Redis is not ready", async () => {
  const { restore } = withoutRedis();
  const email = "clear@example.com";
  const ip = "203.0.113.11";

  try {
    await increaseFailedLoginAttempts(email, ip);
    await increaseFailedLoginAttempts(email, ip);
    assert.equal(await getFailedLoginAttempts(email, ip), 2);

    await clearFailedLoginAttempts(email, ip);
    assert.equal(await getFailedLoginAttempts(email, ip), 0);
  } finally {
    restore();
  }
});

test("the counter of one client does not leak into another", async () => {
  const { restore } = withoutRedis();
  const email = "scoped@example.com";

  try {
    await increaseFailedLoginAttempts(email, "203.0.113.20");
    await increaseFailedLoginAttempts(email, "203.0.113.20");

    assert.equal(await getFailedLoginAttempts(email, "203.0.113.20"), 2);
    assert.equal(await getFailedLoginAttempts(email, "203.0.113.21"), 0);
  } finally {
    restore();
  }
});
