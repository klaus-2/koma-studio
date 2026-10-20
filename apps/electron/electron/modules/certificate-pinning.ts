/**
 * Certificate pinning helpers + session verify proc.
 */
import { type Session } from "electron";
import { createHash, X509Certificate } from "node:crypto";
import { normalizeHost } from "./shared.ts";
import { resolveDesktopEnvValue } from "./runtime-env.ts";

const CERT_PIN_ERROR = -2;
const CERT_PIN_USE_CHROMIUM_VALIDATION = -3;
let certificatePinningConfigured = false;
let cachedCertificatePinsByHost: Map<string, Set<string>> | null = null;

const normalizeSha256Fingerprint = (value: string): string =>
  value.replace(/[^A-Fa-f0-9]/g, "").toUpperCase();

const parseSha256Pins = (rawValue: string | null): Set<string> => {
  if (!rawValue) {
    return new Set<string>();
  }

  return new Set(
    rawValue
      .split(",")
      .map((value) => normalizeSha256Fingerprint(value))
      .filter((value) => value.length === 64),
  );
};

const parseHostFromUrl = (rawUrl: string | null): string | null => {
  if (!rawUrl) {
    return null;
  }
  try {
    return normalizeHost(new URL(rawUrl).hostname);
  } catch {
    return null;
  }
};

const getCertificatePinsByHost = (authApiUrl: string): Map<string, Set<string>> => {
  if (cachedCertificatePinsByHost) {
    return cachedCertificatePinsByHost;
  }

  const byHost = new Map<string, Set<string>>();
  const rules: Array<{ targetUrl: string; envKey: string }> = [
    { targetUrl: authApiUrl, envKey: "AUTH_API_CERT_PINS_SHA256" },
    { targetUrl: resolveDesktopEnvValue("UPDATE_SERVER_URL") ?? "", envKey: "UPDATE_SERVER_CERT_PINS_SHA256" },
  ];

  for (const rule of rules) {
    const host = parseHostFromUrl(rule.targetUrl);
    if (!host) {
      continue;
    }
    const pins = parseSha256Pins(resolveDesktopEnvValue(rule.envKey));
    if (pins.size === 0) {
      continue;
    }

    const existing = byHost.get(host);
    if (!existing) {
      byHost.set(host, pins);
      continue;
    }

    pins.forEach((pin) => {
      existing.add(pin);
    });
  }

  cachedCertificatePinsByHost = byHost;
  return byHost;
};

const extractCertificatePinSha256 = (certificateData: string | undefined): string => {
  if (!certificateData) {
    return "";
  }

  try {
    const certificate = new X509Certificate(certificateData);
    return normalizeSha256Fingerprint(certificate.fingerprint256);
  } catch {
    return "";
  }
};

const extractCertificatePublicKeyPinSha256 = (certificateData: string | undefined): string => {
  if (!certificateData) {
    return "";
  }

  try {
    const certificate = new X509Certificate(certificateData);
    const spki = certificate.publicKey.export({ type: "spki", format: "der" });
    return createHash("sha256").update(spki).digest("hex").toUpperCase();
  } catch {
    return "";
  }
};

const setupCertificatePinning = (
  isDev: boolean,
  targetSession: Session,
  authApiUrl: string,
): void => {
  if (isDev || certificatePinningConfigured) {
    return;
  }

  const pinsByHost = getCertificatePinsByHost(authApiUrl);
  if (pinsByHost.size === 0) {
    return;
  }

  targetSession.setCertificateVerifyProc((request, callback) => {
    const host = normalizeHost(request.hostname ?? "");
    const allowedPins = pinsByHost.get(host);
    if (!allowedPins || allowedPins.size === 0) {
      callback(CERT_PIN_USE_CHROMIUM_VALIDATION);
      return;
    }

    const presentedFingerprint = extractCertificatePinSha256(request.certificate?.data);
    const presentedPublicKeyPin = extractCertificatePublicKeyPinSha256(request.certificate?.data);
    const hasAnyPresentedPin =
      presentedFingerprint.length === 64 || presentedPublicKeyPin.length === 64;

    if (!hasAnyPresentedPin) {
      console.error(
        `[desktop-security] certificate pin verification failed for ${host}: unable to extract certificate fingerprint/SPKI pin.`,
      );
      callback(CERT_PIN_ERROR);
      return;
    }

    const fingerprintMatch = presentedFingerprint.length === 64 && allowedPins.has(presentedFingerprint);
    const publicKeyMatch = presentedPublicKeyPin.length === 64 && allowedPins.has(presentedPublicKeyPin);
    const matched = fingerprintMatch || publicKeyMatch;
    if (!matched) {
      console.error(
        `[desktop-security] certificate pin mismatch for ${host}: fingerprint=${presentedFingerprint || "unavailable"} spki=${presentedPublicKeyPin || "unavailable"}`,
      );
    }

    callback(matched ? 0 : CERT_PIN_ERROR);
  });

  certificatePinningConfigured = true;
};

export { getCertificatePinsByHost, setupCertificatePinning };
