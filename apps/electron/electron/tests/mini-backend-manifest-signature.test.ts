import assert from "node:assert/strict";
import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import test from "node:test";

import { verifyMiniBackendRuntimeManifestSignature } from "../modules/mini-backend-manifest-signature.ts";

const createFixture = (): { privateKey: KeyObject; publicKeyBase64: string } => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const jwk = publicKey.export({ format: "jwk" });
  assert.ok(jwk.x);
  return {
    privateKey,
    publicKeyBase64: Buffer.from(jwk.x, "base64url").toString("base64"),
  };
};

const signBody = (body: string, privateKey: KeyObject): string =>
  `ed25519-${sign(null, Buffer.from(body, "utf8"), privateKey).toString("base64")}`;

test("accepts a manifest signed with the pinned key", () => {
  const { privateKey, publicKeyBase64 } = createFixture();
  const body = '{\n  "version": "1.1.0"\n}\n';
  verifyMiniBackendRuntimeManifestSignature(
    body,
    signBody(body, privateKey),
    `ed25519-${publicKeyBase64}`,
  );
});

test("rejects a tampered manifest body", () => {
  const { privateKey, publicKeyBase64 } = createFixture();
  const body = '{"version":"1.1.0"}';
  const signature = signBody(body, privateKey);
  assert.throws(
    () =>
      verifyMiniBackendRuntimeManifestSignature(
        '{"version":"9.9.9"}',
        signature,
        publicKeyBase64,
      ),
    /signature verification failed/,
  );
});

test("rejects a signature from a different key", () => {
  const first = createFixture();
  const second = createFixture();
  const body = '{"version":"1.1.0"}';
  assert.throws(
    () =>
      verifyMiniBackendRuntimeManifestSignature(
        body,
        signBody(body, first.privateKey),
        second.publicKeyBase64,
      ),
    /signature verification failed/,
  );
});

test("rejects malformed key and signature lengths", () => {
  assert.throws(
    () => verifyMiniBackendRuntimeManifestSignature("{}", "AAAA", "AAAA"),
    /public key must be 32 bytes/,
  );
});
