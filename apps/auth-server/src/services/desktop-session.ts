import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";

import { db } from "../db/client.js";
import { desktopAuthDevice, desktopTravelToken } from "../db/schema.js";
import { tServer } from "./server-i18n.js";

/**
 * Desktop-session service — owns the desktop-client session state, the device
 * registry, the travel-token consumption, the TTL clamps and the slot-machine
 * decision. Extracted from routes/_shared.ts (state + device registry) and
 * routes/desktop.ts (slot machine); routes stay thin over it.
 *
 * The in-memory session Map is a module-global singleton (same lifetime the
 * pre-extraction export had). The cleanup timestamp is mutable module state —
 * exported getter-only (no live re-export of the mutable binding).
 */

export const DESKTOP_TOKEN_MIN_TTL_SEC = 300;
export const DESKTOP_TOKEN_MAX_TTL_SEC = 900;
export const DESKTOP_TRAVEL_TOKEN_MIN_TTL_MINUTES = 5;
export const DESKTOP_TRAVEL_TOKEN_MAX_TTL_MINUTES = 180;
export const DESKTOP_TRAVEL_DEVICE_MIN_DAYS = 1;
export const DESKTOP_TRAVEL_DEVICE_MAX_DAYS = 60;
export const DESKTOP_PRIMARY_SLOT = "primary";
export const DESKTOP_TRAVEL_SLOT = "travel";

export type DesktopDeviceSlot = typeof DESKTOP_PRIMARY_SLOT | typeof DESKTOP_TRAVEL_SLOT;
export type DesktopTravelTokenDeliveryMode = "copy" | "email";
export type DesktopAuthDeviceRow = typeof desktopAuthDevice.$inferSelect;
export type DesktopTravelTokenRow = typeof desktopTravelToken.$inferSelect;

export interface DesktopClientSessionRecord {
  sessionId: string;
  deviceId: string;
  userId: string | null;
  tokenHash: string;
  previousTokenHash: string | null;
  previousTokenValidUntilMs: number;
  expiresAtMs: number;
  createdAtMs: number;
  updatedAtMs: number;
}

export const desktopClientSessions = new Map<string, DesktopClientSessionRecord>();

let lastDesktopSessionCleanupAtMs = 0;

/** Getter-only view of the mutable cleanup timestamp (no live re-export). */
export const getLastDesktopSessionCleanupAtMs = (): number => lastDesktopSessionCleanupAtMs;

export const readHeaderValue = (value: string | string[] | undefined): string | null => {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (typeof normalized !== "string") {
    return null;
  }

  const trimmed = normalized.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const parsePositiveInteger = (value: unknown, fallback: number): number => {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    return fallback;
  }
  return numberValue;
};

export const safeTokenEquals = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
};

export const clampDesktopTokenTtlSec = (value: unknown, fallback: number): number => {
  const ttl = parsePositiveInteger(value, fallback);
  return Math.max(DESKTOP_TOKEN_MIN_TTL_SEC, Math.min(DESKTOP_TOKEN_MAX_TTL_SEC, ttl));
};

export const clampDesktopTravelTokenTtlMinutes = (value: unknown, fallback: number): number => {
  const ttl = parsePositiveInteger(value, fallback);
  return Math.max(
    DESKTOP_TRAVEL_TOKEN_MIN_TTL_MINUTES,
    Math.min(DESKTOP_TRAVEL_TOKEN_MAX_TTL_MINUTES, ttl),
  );
};

export const clampDesktopTravelDurationDays = (value: unknown, fallback: number): number => {
  const days = parsePositiveInteger(value, fallback);
  return Math.max(DESKTOP_TRAVEL_DEVICE_MIN_DAYS, Math.min(DESKTOP_TRAVEL_DEVICE_MAX_DAYS, days));
};

export const normalizeDesktopTravelTokenDeliveryMode = (
  value: unknown,
): DesktopTravelTokenDeliveryMode => (value === "email" ? "email" : "copy");

export const maskEmailAddress = (value: string): string => {
  const [localPartRaw, domainRaw] = value.split("@");
  const localPart = localPartRaw?.trim() ?? "";
  const domain = domainRaw?.trim() ?? "";
  if (!localPart || !domain) {
    return value;
  }

  const maskedLocalPart =
    localPart.length <= 2
      ? `${localPart[0] ?? "*"}*`
      : `${localPart.slice(0, 2)}${"*".repeat(Math.max(2, localPart.length - 2))}`;
  return `${maskedLocalPart}@${domain}`;
};

export const isSafeDesktopIdentifier = (value: string): boolean =>
  /^[A-Za-z0-9:_-]{12,128}$/.test(value);

export const normalizeDesktopSlot = (value: string | null | undefined): DesktopDeviceSlot | null => {
  if (value === DESKTOP_PRIMARY_SLOT || value === DESKTOP_TRAVEL_SLOT) {
    return value;
  }
  return null;
};

/** Structural device view the pure helpers need (DB rows are assignable). */
export interface DesktopSlotDeviceInput {
  readonly slot: string | null;
  readonly hwidHmac: string;
  readonly expiresAt: Date | null;
}

export const isDesktopTravelDeviceActive = (
  device: DesktopSlotDeviceInput | null | undefined,
  nowMs: number = Date.now(),
): boolean => {
  if (!device || normalizeDesktopSlot(device.slot) !== DESKTOP_TRAVEL_SLOT) {
    return false;
  }
  if (!device.expiresAt) {
    return false;
  }
  return device.expiresAt.getTime() > nowMs;
};

export const getDesktopDeviceByUserAndSlot = async (
  userId: string,
  slot: DesktopDeviceSlot,
): Promise<DesktopAuthDeviceRow | null> => {
  const [device] = await db
    .select()
    .from(desktopAuthDevice)
    .where(and(eq(desktopAuthDevice.userId, userId), eq(desktopAuthDevice.slot, slot)))
    .limit(1);
  return device ?? null;
};

export const getDesktopDeviceByUserAndHwid = async (
  userId: string,
  deviceHmac: string,
  nowMs: number = Date.now(),
): Promise<DesktopAuthDeviceRow | null> => {
  const primaryDevice = await getDesktopDeviceByUserAndSlot(userId, DESKTOP_PRIMARY_SLOT);
  if (primaryDevice && safeTokenEquals(primaryDevice.hwidHmac, deviceHmac)) {
    return primaryDevice;
  }

  const travelDevice = await getDesktopDeviceByUserAndSlot(userId, DESKTOP_TRAVEL_SLOT);
  if (isDesktopTravelDeviceActive(travelDevice, nowMs) && travelDevice && safeTokenEquals(travelDevice.hwidHmac, deviceHmac)) {
    return travelDevice;
  }

  return null;
};

export const upsertDesktopDevice = async (params: {
  userId: string;
  slot: DesktopDeviceSlot;
  deviceHmac: string;
  deviceKeyHash: string;
  expiresAt?: Date | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<DesktopAuthDeviceRow> => {
  const now = new Date();
  const existing = await getDesktopDeviceByUserAndSlot(params.userId, params.slot);
  const values = {
    hwidHmac: params.deviceHmac,
    deviceKeyHash: params.deviceKeyHash,
    expiresAt: params.slot === DESKTOP_TRAVEL_SLOT ? params.expiresAt ?? null : null,
    lastSeenAt: now,
    lastSeenIp: params.ipAddress ?? null,
    lastSeenUserAgent: params.userAgent ?? null,
    updatedAt: now,
  };

  if (!existing) {
    const [created] = await db
      .insert(desktopAuthDevice)
      .values({
        id: randomUUID(),
        userId: params.userId,
        slot: params.slot,
        createdAt: now,
        ...values,
      })
      .returning();
    if (!created) {
      throw new Error(tServer("en", "auth.desktop.linkCreateFailed"));
    }
    return created;
  }

  const [updated] = await db
    .update(desktopAuthDevice)
    .set(values)
    .where(eq(desktopAuthDevice.id, existing.id))
    .returning();
  if (!updated) {
    throw new Error(tServer("en", "auth.desktop.linkUpdateFailed"));
  }
  return updated;
};

export const sha256Hex = (payload: string | Buffer): string =>
  createHash("sha256").update(payload).digest("hex");

export const consumeDesktopTravelToken = async (params: {
  userId: string;
  token: string;
  consumedByHwidHmac: string;
}): Promise<DesktopTravelTokenRow | null> => {
  const tokenHash = sha256Hex(params.token);
  const now = new Date();
  const [row] = await db
    .select()
    .from(desktopTravelToken)
    .where(
      and(
        eq(desktopTravelToken.userId, params.userId),
        eq(desktopTravelToken.tokenHash, tokenHash),
        isNull(desktopTravelToken.consumedAt),
        gt(desktopTravelToken.expiresAt, now),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  const [consumed] = await db
    .update(desktopTravelToken)
    .set({
      consumedAt: now,
      consumedByHwidHmac: params.consumedByHwidHmac,
      updatedAt: now,
    })
    .where(eq(desktopTravelToken.id, row.id))
    .returning();

  return consumed ?? null;
};

export const findDesktopDeviceByCredential = async (params: {
  deviceHmac: string;
  deviceKeyHash: string;
  nowMs: number;
}): Promise<DesktopAuthDeviceRow | null> => {
  const [device] = await db
    .select()
    .from(desktopAuthDevice)
    .where(
      and(
        eq(desktopAuthDevice.hwidHmac, params.deviceHmac),
        eq(desktopAuthDevice.deviceKeyHash, params.deviceKeyHash),
      ),
    )
    .limit(1);
  if (!device) {
    return null;
  }

  const slot = normalizeDesktopSlot(device.slot);
  if (slot === DESKTOP_TRAVEL_SLOT && !isDesktopTravelDeviceActive(device, params.nowMs)) {
    return null;
  }

  return device;
};

export const cleanupExpiredDesktopClientSessions = (nowMs: number = Date.now()): void => {
  for (const [sessionId, record] of desktopClientSessions.entries()) {
    if (record.expiresAtMs <= nowMs) {
      desktopClientSessions.delete(sessionId);
    }
  }
  lastDesktopSessionCleanupAtMs = nowMs;
};

export const cleanupDesktopClientSessionsIfNeeded = (nowMs: number = Date.now()): void => {
  if (nowMs - lastDesktopSessionCleanupAtMs > 60_000) {
    cleanupExpiredDesktopClientSessions(nowMs);
  }
};

export const purgeDesktopClientSessionsForUser = (userId: string): void => {
  for (const [sessionId, record] of desktopClientSessions.entries()) {
    if (record.userId === userId) {
      desktopClientSessions.delete(sessionId);
    }
  }
};

/* ── Slot machine (extracted pure decision from routes/desktop.ts register) ── */

/**
 * The five register slot transitions, as a pure decision over the device rows,
 * the caller-provided travel token presence and the env flags:
 * - register-primary: no primary device yet, or the same hardware re-claims it
 *   (primary/travel claim + hijack of the primary slot by the same hwid);
 * - register-travel-reuse: an ACTIVE travel device with the same hwid reuses
 *   its expiry (expiry reuse);
 * - deny-travel-token-required: a different hwid with no travel token
 *   available (travel busy);
 * - consume-travel-token: a travel token was provided — the caller consumes
 *   it (DB) and registers the travel slot with the clamped duration (travel
 *   free); consumption failure maps to the invalid-token denial.
 * - disableTravelTokenEnforcement bypasses the travel-token requirement and
 *   lands on the primary slot.
 */
export type DesktopSlotDecision =
  | { readonly action: "register-primary" }
  | { readonly action: "register-travel-reuse"; readonly travelExpiresAt: Date | null }
  | { readonly action: "consume-travel-token" }
  | { readonly action: "deny-travel-token-required" };

export const resolveDesktopSlotDecision = (input: {
  readonly primaryDevice: DesktopSlotDeviceInput | null;
  readonly travelDevice: DesktopSlotDeviceInput | null;
  readonly deviceHmac: string;
  readonly nowMs: number;
  readonly hasProvidedTravelToken: boolean;
  readonly disableTravelTokenEnforcement: boolean;
}): DesktopSlotDecision => {
  if (!input.primaryDevice) {
    return { action: "register-primary" };
  }
  if (safeTokenEquals(input.primaryDevice.hwidHmac, input.deviceHmac)) {
    return { action: "register-primary" };
  }

  const activeTravelDevice = isDesktopTravelDeviceActive(input.travelDevice, input.nowMs)
    ? input.travelDevice
    : null;
  if (activeTravelDevice && safeTokenEquals(activeTravelDevice.hwidHmac, input.deviceHmac)) {
    return { action: "register-travel-reuse", travelExpiresAt: activeTravelDevice.expiresAt };
  }

  if (input.disableTravelTokenEnforcement) {
    return { action: "register-primary" };
  }
  if (!input.hasProvidedTravelToken) {
    return { action: "deny-travel-token-required" };
  }
  return { action: "consume-travel-token" };
};
