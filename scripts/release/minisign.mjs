import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ED25519_PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

const decodeKeyDocument = (rawText) => {
  const trimmed = rawText.trim();
  const text = trimmed.includes("untrusted comment:")
    ? trimmed
    : Buffer.from(trimmed, "base64").toString("utf8");
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) {
    throw new Error("Invalid Minisign key format: expected at least 2 lines.");
  }
  return Buffer.from(lines[1], "base64");
};

const privateKeyFromSeed32 = (seed32) =>
  crypto.createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_PREFIX, seed32]),
    format: "der",
    type: "pkcs8",
  });

const publicBytesFromPrivateKey = (privateKey) =>
  crypto.createPublicKey(privateKey).export({ format: "der", type: "spki" }).subarray(-32);

const deriveScryptParams = (opslimitBig, memlimitBig) => {
  const memlimit = Number(memlimitBig);
  const opslimit = Number(opslimitBig);
  const r = 8;
  const rawN = Math.floor(memlimit / (128 * r));
  let n = 1;
  while (n * 2 <= rawN) {
    n *= 2;
  }
  if (n < 16384) {
    n = 32768;
  }
  const p = Math.max(1, Math.round(opslimit / (4 * n * r)));
  return { N: n, r, p, maxmem: Math.max(256 * 1024 * 1024, memlimit * 2) };
};

export const loadMinisignSecretKey = ({ keyPath, password = "" }) => {
  const rawText = fs.readFileSync(keyPath, "utf8");
  const bin = decodeKeyDocument(rawText);
  const sigAlg = bin.subarray(0, 2).toString("ascii");
  if (sigAlg !== "Ed") {
    throw new Error(`Unsupported Minisign key algorithm: ${sigAlg}`);
  }
  const kdfAlg = bin.subarray(2, 4);

  let decrypted;
  if (kdfAlg[0] === 0 && kdfAlg[1] === 0) {
    if (bin.length < 110) {
      throw new Error(`Invalid unencrypted Minisign secret key length: ${bin.length}`);
    }
    decrypted = bin.subarray(6, 110);
  } else if (kdfAlg.toString("ascii") === "Sc") {
    if (bin.length < 158) {
      throw new Error(`Invalid encrypted Minisign secret key length: ${bin.length}`);
    }
    const salt = bin.subarray(6, 38);
    const opslimit = bin.readBigUInt64LE(38);
    const memlimit = bin.readBigUInt64LE(46);
    const encrypted = bin.subarray(54, 158);
    const scryptOpts = deriveScryptParams(opslimit, memlimit);
    const keystream = crypto.scryptSync(password, salt, encrypted.length, scryptOpts);
    decrypted = Buffer.alloc(encrypted.length);
    for (let i = 0; i < encrypted.length; i += 1) {
      decrypted[i] = encrypted[i] ^ keystream[i];
    }
  } else {
    throw new Error(`Unsupported Minisign KDF algorithm: ${kdfAlg.toString("hex")}`);
  }

  const keyId = decrypted.subarray(0, 8);
  const seed32 = decrypted.subarray(8, 40);
  const storedPub32 = decrypted.subarray(40, 72);
  const privateKey = privateKeyFromSeed32(seed32);
  const derivedPub32 = publicBytesFromPrivateKey(privateKey);
  if (!derivedPub32.equals(storedPub32)) {
    throw new Error("Failed to decrypt Minisign secret key (wrong password or corrupt key).");
  }
  return { keyId, privateKey, publicKeyBytes: derivedPub32 };
};

export const loadMinisignPublicKey = (rawPubText) => {
  const bin = decodeKeyDocument(rawPubText);
  if (bin.length !== 42 || bin.subarray(0, 2).toString("ascii") !== "Ed") {
    throw new Error("Invalid Minisign public key.");
  }
  const keyId = bin.subarray(2, 10);
  const pub32 = bin.subarray(10, 42);
  const publicKey = crypto.createPublicKey({
    key: { kty: "OKP", crv: "Ed25519", x: pub32.toString("base64url") },
    format: "jwk",
  });
  return { keyId, publicKey, pub32 };
};

export const signMinisignWithVersion = ({
  filePath,
  keyPath,
  password = process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD ?? "",
  version,
  outputSigPath = `${filePath}.sig`,
}) => {
  if (!version || !String(version).trim()) {
    throw new Error("version is required when signing with Minisign requireSignedVersion");
  }
  const { keyId, privateKey } = loadMinisignSecretKey({ keyPath, password });
  const data = fs.readFileSync(filePath);
  const prehash = crypto.createHash("blake2b512").update(data).digest();
  const dataSig = crypto.sign(null, prehash, privateKey);
  const line2 = Buffer.concat([Buffer.from("ED", "ascii"), keyId, dataSig]).toString("base64");

  const timestamp = Math.floor(Date.now() / 1000);
  const trustedPayload = `timestamp:${timestamp}\tfile:${path.basename(filePath)}\tversion:${String(version).trim()}`;
  const globalInput = Buffer.concat([dataSig, Buffer.from(trustedPayload, "utf8")]);
  const globalSig = crypto.sign(null, globalInput, privateKey).toString("base64");

  const decodedSigDocument = [
    "untrusted comment: signature from koma release signer",
    line2,
    `trusted comment: ${trustedPayload}`,
    globalSig,
    "",
  ].join("\n");

  const base64Wrapped = `${Buffer.from(decodedSigDocument, "utf8").toString("base64")}\n`;
  fs.writeFileSync(outputSigPath, base64Wrapped, "utf8");
  return base64Wrapped.trim();
};

export const verifyTauriMinisignFile = ({ filePath, sigText, pubkeyText }) => {
  const { keyId: pubKeyId, publicKey } = loadMinisignPublicKey(pubkeyText);
  const trimmed = sigText.trim();
  const decoded = trimmed.includes("trusted comment:")
    ? trimmed
    : Buffer.from(trimmed, "base64").toString("utf8");
  const lines = decoded.split(/\r?\n/).filter(Boolean);
  if (lines.length < 4 || !lines[2].startsWith("trusted comment: ")) {
    throw new Error("Malformed Minisign signature document.");
  }

  const line2 = Buffer.from(lines[1].trim(), "base64");
  if (line2.length !== 74 || line2.subarray(0, 2).toString("ascii") !== "ED") {
    throw new Error("Unsupported or malformed Minisign signature algorithm (expected prehashed ED).");
  }
  const sigKeyId = line2.subarray(2, 10);
  if (!sigKeyId.equals(pubKeyId)) {
    throw new Error("Minisign keyId mismatch.");
  }
  const dataSig = line2.subarray(10, 74);
  const prehash = crypto.createHash("blake2b512").update(fs.readFileSync(filePath)).digest();
  if (!crypto.verify(null, prehash, publicKey, dataSig)) {
    return { valid: false, reason: "data signature invalid" };
  }

  const trustedPayload = lines[2].slice("trusted comment: ".length);
  const globalSig = Buffer.from(lines[3].trim(), "base64");
  const globalInput = Buffer.concat([dataSig, Buffer.from(trustedPayload, "utf8")]);
  if (!crypto.verify(null, globalInput, publicKey, globalSig)) {
    return { valid: false, reason: "global signature invalid" };
  }

  const fields = trustedPayload.split("\t");
  const versionField = fields.find((f) => f.startsWith("version:"));
  return {
    valid: true,
    trustedComment: trustedPayload,
    signedVersion: versionField ? versionField.slice("version:".length) : null,
  };
};
