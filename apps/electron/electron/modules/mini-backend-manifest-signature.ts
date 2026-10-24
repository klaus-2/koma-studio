import { createPublicKey, verify } from "node:crypto";

const normalize = (value: string): string => {
  const trimmed = value.trim();
  return trimmed.startsWith("ed25519-")
    ? trimmed.slice("ed25519-".length)
    : trimmed;
};

/**
 * Verifies the detached signature published next to `latest.json` against the
 * build-time pinned key (raw 32-byte Ed25519 key, base64).
 */
export const verifyMiniBackendRuntimeManifestSignature = (
  body: string,
  signature: string,
  publicKeyBase64: string,
): void => {
  const rawKey = Buffer.from(normalize(publicKeyBase64), "base64");
  if (rawKey.length !== 32) {
    throw new Error("Runtime manifest public key must be 32 bytes.");
  }
  const publicKey = createPublicKey({
    key: { kty: "OKP", crv: "Ed25519", x: rawKey.toString("base64url") },
    format: "jwk",
  });

  const rawSignature = Buffer.from(normalize(signature), "base64");
  if (rawSignature.length !== 64) {
    throw new Error("Runtime manifest signature must be 64 bytes.");
  }
  if (!verify(null, Buffer.from(body, "utf8"), publicKey, rawSignature)) {
    throw new Error("Runtime manifest signature verification failed.");
  }
};
