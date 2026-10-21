import test from "node:test";
import assert from "node:assert/strict";
import { createCipheriv, randomBytes } from "node:crypto";

import { decodeProtectedConfig } from "../modules/runtime-config-decode.ts";

// Reassembled from the scrambled key fragments (must match the key baked by
// scripts/harden-electron.mjs into the protected runtime-config payloads).
const KEY = Buffer.from(
  "331225c7868ff43e9783e80737c1fc2a8fbd7712d55fe1ba7126d4d69b5684f4",
  "hex",
);

const payload = { localApiUrl: "http://127.0.0.1:8001", authApiUrl: "https://api.test" };

const gcmConfig = (data: Record<string, string>, version?: number) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(data), "utf-8")),
    cipher.final(),
  ]);
  return {
    _protected: true as const,
    ...(version === undefined ? {} : { _v: version as number }),
    _d: encrypted.toString("base64"),
    _iv: iv.toString("hex"),
    _tag: cipher.getAuthTag().toString("hex"),
  };
};

const xorConfig = (data: Record<string, string>, key: number) => {
  const inner = Buffer.from(JSON.stringify(data), "utf-8").toString("base64");
  const xored = Buffer.from(inner, "utf-8");
  for (let i = 0; i < xored.length; i++) {
    xored[i] ^= key;
  }
  return {
    _protected: true as const,
    _v: 1 as const,
    _d: xored.toString("base64"),
    _k: key,
  };
};

test("decodes a v2 AES-256-GCM protected config", () => {
  assert.deepEqual(decodeProtectedConfig(gcmConfig(payload, 2)), payload);
});

test("decodes a v1 XOR protected config", () => {
  assert.deepEqual(decodeProtectedConfig(xorConfig(payload, 171)), payload);
});

test("unknown version without _v: GCM is attempted first and succeeds", () => {
  // Same GCM payload but the version field is missing entirely.
  const { _v: _omitted, ...unknownVersion } = gcmConfig(payload, 2);
  assert.deepEqual(decodeProtectedConfig(unknownVersion), payload);
});

test("unknown version: GCM failure falls back to the legacy XOR path", () => {
  // GCM-shaped fields present but the auth tag is garbage, while the XOR
  // fields are valid — the loader's unknown-version scenario.
  const xor = xorConfig(payload, 99);
  const mixed = {
    _protected: true as const,
    _v: 99,
    _d: xor._d,
    _iv: randomBytes(12).toString("hex"),
    _tag: randomBytes(16).toString("hex"),
    _k: xor._k,
  };
  assert.deepEqual(decodeProtectedConfig(mixed), payload);
});

test("throws on an unrecognized protected payload", () => {
  assert.throws(
    () => decodeProtectedConfig({ _protected: true, _d: "not-a-payload" }),
    /unrecognized protected config payload/,
  );
});
