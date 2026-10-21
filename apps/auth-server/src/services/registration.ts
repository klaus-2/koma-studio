import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";

import { db } from "../db/client.js";
import { legalAcceptance, user } from "../db/schema.js";
import {
  assertRegistrationAllowed,
  isRegistrationIdentityConflictError,
  persistRegistrationIdentity,
  type DesktopSignalValidationResult,
  type RegistrationIdentityHashes,
  type RegistrationIdentityType,
} from "../security/registration-guard.js";
import { recordSecurityLog } from "../security/anomaly.js";
import { logger } from "../utils/logger.js";
import type { NormalizedLegalAcceptance } from "../legal/acceptance.js";

/**
 * Registration service — owns the multi-account policy check, the
 * legal-acceptance persistence, the user-compensation deletes and the
 * registration-identity persistence with its conflict re-check. Extracted
 * from routes/auth.ts; the register route stays parse → call → map errors.
 * db stays a module-global singleton (no injection).
 */

/** Owner-role bootstrap moved with the registration flow (single consumer). */
export const bootstrapOwnerRoleIfNeeded = async (userId: string): Promise<void> => {
  const [staffUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(inArray(user.appRole, ["owner", "admin"]))
    .limit(1);

  if (staffUser) {
    return;
  }

  await db
    .update(user)
    .set({
      appRole: "owner",
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId));
};

export type DesktopRegistrationPolicyOutcome =
  | { readonly ok: true; readonly identityHashes: RegistrationIdentityHashes | null }
  | {
      readonly ok: false;
      readonly reason: "identity-missing" | "identity-invalid" | "multi-account-blocked";
      readonly signal?: RegistrationIdentityType;
      readonly conflictingUserId?: string;
    };

/**
 * Multi-account policy: under enforced desktop registration, valid desktop
 * identity signals are required and must not collide with an existing
 * account (recordSecurityLog on the conflicting user mirrors the pre-
 * extraction blockMultiAccountRegistration logging).
 */
export const assertDesktopRegistrationPolicy = async (params: {
  readonly desktopSignalValidation: DesktopSignalValidationResult;
  readonly desktopRegistrationEnforced: boolean;
  readonly ipAddress: string;
  readonly userAgent: string;
}): Promise<DesktopRegistrationPolicyOutcome> => {
  if (!params.desktopRegistrationEnforced) {
    return { ok: true, identityHashes: null };
  }

  if (!params.desktopSignalValidation.ok) {
    return {
      ok: false,
      reason: params.desktopSignalValidation.error === "missing" ? "identity-missing" : "identity-invalid",
    };
  }

  const identityHashes: RegistrationIdentityHashes = {
    desktopHwidHmac: params.desktopSignalValidation.signals.desktopHwidHmac,
    desktopMacHmac: params.desktopSignalValidation.signals.desktopMacHmac,
    ipSubnetHmac: params.desktopSignalValidation.signals.ipSubnetHmac,
  };

  const registrationAllowed = await assertRegistrationAllowed(identityHashes);
  if (!registrationAllowed.allowed) {
    if (registrationAllowed.conflictingUserId) {
      await recordSecurityLog(
        registrationAllowed.conflictingUserId,
        "register_blocked_multi_account",
        "warning",
        params.ipAddress,
        params.userAgent,
        { signal: registrationAllowed.signal },
      );
    }
    return {
      ok: false,
      reason: "multi-account-blocked",
      signal: registrationAllowed.signal,
      conflictingUserId: registrationAllowed.conflictingUserId,
    };
  }

  return { ok: true, identityHashes };
};

/**
 * User-compensation delete: the registration must not leave a half-registered
 * user behind when the post-signUp persistence steps fail. Logs the delete
 * failure with the caller-provided context (verbatim pre-extraction
 * messages).
 */
const deleteRegisteredUserCompensation = async (
  userId: string,
  failureLogContext: string,
): Promise<void> => {
  try {
    await db.delete(user).where(eq(user.id, userId));
  } catch (deleteError) {
    logger.error(failureLogContext, {
      userId,
      error:
        deleteError instanceof Error
          ? { message: deleteError.message, stack: deleteError.stack }
          : deleteError,
    });
  }
};

export type RegistrationLegalAcceptanceOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "legal-acceptance-failed" };

/** Legal-acceptance persistence with user-compensation on failure. */
export const recordRegistrationLegalAcceptance = async (params: {
  readonly userId: string;
  readonly legalAcceptance: NormalizedLegalAcceptance;
  readonly ipAddress: string;
  readonly userAgent: string;
  readonly desktopRegistration: boolean;
}): Promise<RegistrationLegalAcceptanceOutcome> => {
  try {
    await db.insert(legalAcceptance).values({
      id: randomUUID(),
      userId: params.userId,
      source: "register",
      termsVersion: params.legalAcceptance.termsVersion,
      privacyVersion: params.legalAcceptance.privacyVersion,
      cookiesVersion: params.legalAcceptance.cookiesVersion,
      contentVersion: params.legalAcceptance.contentVersion,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: {
        route: "/api/auth/register",
        desktopRegistration: params.desktopRegistration,
      },
    });
    await recordSecurityLog(
      params.userId,
      "legal_acceptance_recorded",
      "info",
      params.ipAddress,
      params.userAgent,
      {
        source: "register",
        termsVersion: params.legalAcceptance.termsVersion,
        privacyVersion: params.legalAcceptance.privacyVersion,
      },
    );
    return { ok: true };
  } catch (error) {
    await deleteRegisteredUserCompensation(
      params.userId,
      "failed_to_delete_user_after_legal_acceptance_error",
    );
    logger.error("failed_to_persist_legal_acceptance", {
      userId: params.userId,
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    });
    return { ok: false, reason: "legal-acceptance-failed" };
  }
};

export type RegistrationIdentityOutcome =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: "identity-conflict";
      readonly signal: RegistrationIdentityType;
      readonly conflictingUserId?: string;
    };

/**
 * Registration-identity persistence: links the desktop identity hashes, then
 * re-checks the multi-account policy when the link collides — compensating
 * with the user delete and re-asserting which signal owns the conflict
 * (verbatim pre-extraction semantics, including the conflict security log).
 */
export const persistRegistrationIdentityWithCompensation = async (params: {
  readonly userId: string;
  readonly identityHashes: RegistrationIdentityHashes;
  readonly ipAddress: string;
  readonly userAgent: string;
}): Promise<RegistrationIdentityOutcome> => {
  try {
    await persistRegistrationIdentity(params.userId, params.identityHashes);
    await bootstrapOwnerRoleIfNeeded(params.userId);
    await recordSecurityLog(
      params.userId,
      "register_identity_linked",
      "info",
      params.ipAddress,
      params.userAgent,
      {
        identityTypes: ["desktop_hwid", "desktop_mac", "ip_subnet"],
      },
    );
    return { ok: true };
  } catch (error) {
    if (isRegistrationIdentityConflictError(error)) {
      await deleteRegisteredUserCompensation(
        params.userId,
        "failed_to_delete_user_after_registration_identity_conflict",
      );

      const conflict = await assertRegistrationAllowed(params.identityHashes);
      const signal = conflict.allowed ? error.signal : conflict.signal;
      const conflictingUserId = conflict.allowed ? undefined : conflict.conflictingUserId;
      if (conflictingUserId) {
        await recordSecurityLog(
          conflictingUserId,
          "register_blocked_multi_account",
          "warning",
          params.ipAddress,
          params.userAgent,
          { signal },
        );
      }
      return { ok: false, reason: "identity-conflict", signal, conflictingUserId };
    }

    throw error;
  }
};
