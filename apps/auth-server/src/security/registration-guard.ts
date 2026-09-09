import type { Request } from "express";

export type RegistrationIdentityType = "desktop_hwid" | "desktop_mac" | "ip_subnet";

export interface RegistrationIdentityHashes {
  desktopHwidHmac: string;
  desktopMacHmac: string;
  ipSubnetHmac: string;
}

export interface DesktopRegistrationSignals extends RegistrationIdentityHashes {
  desktopDeviceId: string;
  desktopMacFingerprint: string;
  ipAddress: string;
  ipSubnet: string;
}

export type DesktopSignalValidationError = "missing" | "invalid";

export type DesktopSignalValidationResult =
  | { ok: true; signals: DesktopRegistrationSignals }
  | { ok: false; error: DesktopSignalValidationError };

export type RegistrationAllowedResult =
  | { allowed: true }
  | { allowed: false; signal: RegistrationIdentityType; conflictingUserId: string };

export class RegistrationIdentityConflictError extends Error {
  readonly signal: RegistrationIdentityType;

  constructor(signal: RegistrationIdentityType) {
    super("Registration identity already linked to another account.");
    this.name = "RegistrationIdentityConflictError";
    this.signal = signal;
  }
}

export const isRegistrationIdentityConflictError = (
  error: unknown,
): error is RegistrationIdentityConflictError => error instanceof RegistrationIdentityConflictError;

export const isSafeDesktopDeviceId = (_value: string): boolean => true;

export const isSafeDesktopMacFingerprint = (_value: string): boolean => true;

export const normalizeIpSubnet = (_ipAddress: string): string | null => null;

export const computeRegistrationIdentityHmac = (
  _type: RegistrationIdentityType,
  _value: string,
): string => "";

export const extractDesktopRegistrationSignals = (
  _req: Request,
  _body: unknown,
): DesktopSignalValidationResult => ({ ok: false, error: "missing" });

export const assertRegistrationAllowed = async (
  _hashes: RegistrationIdentityHashes,
): Promise<RegistrationAllowedResult> => ({ allowed: true });

export const persistRegistrationIdentity = async (
  _userId: string,
  _hashes: RegistrationIdentityHashes,
): Promise<void> => {
  // Disabled: device-fingerprint identity collection removed for open-source.
};
