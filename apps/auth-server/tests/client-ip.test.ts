import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";

import express from "express";

import {
  getClientIp,
  isPrivateOrLoopbackAddress,
  resolveTrustProxy,
} from "../src/security/client-ip.ts";

const withServer = async (
  trustProxy: boolean | number | ((address: string) => boolean),
  run: (baseUrl: string) => Promise<void>,
): Promise<void> => {
  const app = express();
  app.set("trust proxy", trustProxy);
  app.get("/ip", (req, res) => {
    res.json({ ip: getClientIp(req) });
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    const { port } = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
};

const readIp = async (baseUrl: string, forwardedFor?: string): Promise<string> => {
  const response = await fetch(`${baseUrl}/ip`, {
    headers: forwardedFor ? { "x-forwarded-for": forwardedFor } : undefined,
  });
  const payload = (await response.json()) as { ip: string };
  return payload.ip;
};

test("isPrivateOrLoopbackAddress recognizes proxy peer ranges", () => {
  assert.equal(isPrivateOrLoopbackAddress("127.0.0.1"), true);
  assert.equal(isPrivateOrLoopbackAddress("::1"), true);
  assert.equal(isPrivateOrLoopbackAddress("::ffff:127.0.0.1"), true);
  assert.equal(isPrivateOrLoopbackAddress("10.1.2.3"), true);
  assert.equal(isPrivateOrLoopbackAddress("172.16.0.1"), true);
  assert.equal(isPrivateOrLoopbackAddress("172.31.255.255"), true);
  assert.equal(isPrivateOrLoopbackAddress("192.168.1.20"), true);
  assert.equal(isPrivateOrLoopbackAddress("fd00::1"), true);
  assert.equal(isPrivateOrLoopbackAddress("203.0.113.9"), false);
  assert.equal(isPrivateOrLoopbackAddress("172.32.0.1"), false);
  assert.equal(isPrivateOrLoopbackAddress("not-an-ip"), false);
});

test("resolveTrustProxy maps the documented TRUST_PROXY values", () => {
  assert.equal(resolveTrustProxy("false"), false);
  assert.equal(resolveTrustProxy("0"), false);
  assert.equal(resolveTrustProxy("true"), true);
  assert.equal(resolveTrustProxy("2"), 2);
  assert.equal(typeof resolveTrustProxy(undefined), "function");
  assert.equal(typeof resolveTrustProxy("auto"), "function");
});

test("forwarded headers are ignored when proxy trust is disabled", async () => {
  await withServer(false, async (baseUrl) => {
    assert.equal(await readIp(baseUrl, "203.0.113.9"), "127.0.0.1");
  });
});

test("a loopback proxy peer is trusted and only its appended hop is used", async () => {
  await withServer(resolveTrustProxy(undefined), async (baseUrl) => {
    assert.equal(await readIp(baseUrl), "127.0.0.1");
    assert.equal(await readIp(baseUrl, "198.51.100.7"), "198.51.100.7");
    // Client-supplied prefixes cannot steer the result: the rightmost hop
    // (the one the trusted proxy appended) wins.
    assert.equal(
      await readIp(baseUrl, "203.0.113.9, 198.51.100.7"),
      "198.51.100.7",
    );
  });
});

test("explicit hop count still resolves the proxy-appended address", async () => {
  await withServer(resolveTrustProxy("1"), async (baseUrl) => {
    assert.equal(await readIp(baseUrl, "203.0.113.9, 198.51.100.7"), "198.51.100.7");
  });
});
