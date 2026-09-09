import { randomUUID } from "node:crypto";

import type { Request } from "express";
import { and, desc, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";

import { db } from "../db/client.js";
import {
  banTarget,
  type FeedReportEvidence,
  registrationIdentity,
  session,
  type ActiveBanMetadata,
  userBan,
} from "../db/schema.js";
import { getClientIp } from "../security/client-ip.js";
import {
  computeRegistrationIdentityHmac,
  normalizeIpSubnet,
} from "../security/registration-guard.js";
import {
  collectBanTargetHashes,
  getBanPresentation,
  isBanActive,
  type BanCheckSignals,
  type BanIdentityRecord,
  type BanScopePreset,
  type BanTargetRecord,
} from "./bans.js";

interface BanLookupRow {
  banId: string;
  targetUserId: string | null;
  scope: string;
  reason: string;
  evidence: FeedReportEvidence[];
  startsAt: Date | null;
  expiresAt: Date | null;
  liftedAt: Date | null;
  createdAt: Date;
  targetType: string;
  targetHash: string;
}

export interface ActiveBanMatch {
  banId: string;
  targetUserId: string | null;
  scope: BanScopePreset;
  reason: string;
  evidence: FeedReportEvidence[];
  startsAt: Date | null;
  expiresAt: Date | null;
  liftedAt: Date | null;
  createdAt: Date;
  matchedTargets: BanTargetRecord[];
  presentation: ActiveBanMetadata;
}

const toBanScopePreset = (value: unknown): BanScopePreset =>
  value === "account_hwid" || value === "account_hwid_mac_ip" ? (value as BanScopePreset) : "account_only";

const toActiveBanPresentation = (
  reason: string,
  scope: BanScopePreset,
  expiresAt: Date | null,
): ActiveBanMetadata => {
  const presentation = getBanPresentation({
    reason,
    scope,
    expiresAt,
  });

  return {
    ...presentation,
    reason,
    scope,
    expiresAt: expiresAt?.toISOString() ?? null,
  };
};

const toBanMatch = (rows: BanLookupRow[]): ActiveBanMatch | null => {
  const first = rows[0];
  if (!first) {
    return null;
  }

  const scope = toBanScopePreset(first.scope);
  return {
    banId: first.banId,
    targetUserId: first.targetUserId,
    scope,
    reason: first.reason,
    evidence: first.evidence,
    startsAt: first.startsAt,
    expiresAt: first.expiresAt,
    liftedAt: first.liftedAt,
    createdAt: first.createdAt,
    matchedTargets: rows.map((row) => ({
      targetType: row.targetType as BanTargetRecord["targetType"],
      targetHash: row.targetHash,
    })),
    presentation: toActiveBanPresentation(first.reason, scope, first.expiresAt),
  };
};

export const buildBanCheckSignalsForRequest = (
  req: Request,
  options: {
    userId?: string | null;
    desktopDeviceId?: string | null;
    desktopMacFingerprint?: string | null;
  } = {},
): BanCheckSignals => {
  const ipSubnet = normalizeIpSubnet(getClientIp(req));

  return {
    userId: options.userId ?? null,
    desktopHwidHmac: options.desktopDeviceId
      ? computeRegistrationIdentityHmac("desktop_hwid", options.desktopDeviceId)
      : null,
    desktopMacHmac: options.desktopMacFingerprint
      ? computeRegistrationIdentityHmac("desktop_mac", options.desktopMacFingerprint)
      : null,
    ipSubnetHmac: ipSubnet ? computeRegistrationIdentityHmac("ip_subnet", ipSubnet) : null,
  };
};

export const listRegistrationIdentitiesForUser = async (
  userId: string,
): Promise<BanIdentityRecord[]> => {
  const rows = await db
    .select({
      identityType: registrationIdentity.identityType,
      identityHash: registrationIdentity.identityHash,
    })
    .from(registrationIdentity)
    .where(eq(registrationIdentity.userId, userId));

  return rows
    .filter((row) =>
      row.identityType === "desktop_hwid" ||
      row.identityType === "desktop_mac" ||
      row.identityType === "ip_subnet",
    )
    .map((row) => ({
      identityType: row.identityType as BanIdentityRecord["identityType"],
      identityHash: row.identityHash,
    }));
};

export const findActiveBanForSignals = async (
  signals: BanCheckSignals,
  now: Date = new Date(),
): Promise<ActiveBanMatch | null> => {
  const candidateTargets: BanTargetRecord[] = [];
  if (signals.userId) {
    candidateTargets.push({ targetType: "account", targetHash: signals.userId });
  }
  if (signals.desktopHwidHmac) {
    candidateTargets.push({ targetType: "desktop_hwid", targetHash: signals.desktopHwidHmac });
  }
  if (signals.desktopMacHmac) {
    candidateTargets.push({ targetType: "desktop_mac", targetHash: signals.desktopMacHmac });
  }
  if (signals.ipSubnetHmac) {
    candidateTargets.push({ targetType: "ip_subnet", targetHash: signals.ipSubnetHmac });
  }

  if (candidateTargets.length === 0) {
    return null;
  }

  const targetHashes = candidateTargets.map((target) => target.targetHash);
  const targetTypes = candidateTargets.map((target) => target.targetType);
  const rows = await db
    .select({
      banId: userBan.id,
      targetUserId: userBan.targetUserId,
      scope: userBan.scope,
      reason: userBan.reason,
      evidence: userBan.evidence,
      startsAt: userBan.startsAt,
      expiresAt: userBan.expiresAt,
      liftedAt: userBan.liftedAt,
      createdAt: userBan.createdAt,
      targetType: banTarget.targetType,
      targetHash: banTarget.targetHash,
    })
    .from(userBan)
    .innerJoin(banTarget, eq(banTarget.banId, userBan.id))
    .where(
      and(
        inArray(banTarget.targetHash, targetHashes),
        inArray(banTarget.targetType, targetTypes),
        or(isNull(userBan.startsAt), lte(userBan.startsAt, now)),
        or(isNull(userBan.expiresAt), gt(userBan.expiresAt, now)),
        isNull(userBan.liftedAt),
      ),
    )
    .orderBy(desc(userBan.createdAt));

  const matchedRows = rows.filter((row) =>
    candidateTargets.some(
      (target) => target.targetType === row.targetType && target.targetHash === row.targetHash,
    ),
  ) as BanLookupRow[];

  if (matchedRows.length === 0) {
    return null;
  }

  const byBanId = new Map<string, BanLookupRow[]>();
  for (const row of matchedRows) {
    if (!isBanActive(row, now)) {
      continue;
    }

    const current = byBanId.get(row.banId) ?? [];
    current.push(row);
    byBanId.set(row.banId, current);
  }

  const firstMatch = byBanId.values().next().value as BanLookupRow[] | undefined;
  return firstMatch ? toBanMatch(firstMatch) : null;
};

export const createBanForUser = async (params: {
  targetUserId: string;
  actorUserId: string;
  scope: BanScopePreset;
  reason: string;
  evidence: FeedReportEvidence[];
  startsAt?: Date | null;
  expiresAt?: Date | null;
}): Promise<ActiveBanMatch> => {
  const identities = await listRegistrationIdentitiesForUser(params.targetUserId);
  const targets = collectBanTargetHashes(params.scope, params.targetUserId, identities);
  const now = new Date();
  const banId = randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(userBan).values({
      id: banId,
      targetUserId: params.targetUserId,
      actorUserId: params.actorUserId,
      scope: params.scope,
      reason: params.reason,
      evidence: params.evidence,
      startsAt: params.startsAt ?? now,
      expiresAt: params.expiresAt ?? null,
      createdAt: now,
      updatedAt: now,
    });

    await tx.insert(banTarget).values(
      targets.map((target) => ({
        id: randomUUID(),
        banId,
        targetType: target.targetType,
        targetHash: target.targetHash,
        createdAt: now,
      })),
    );
  });

  return {
    banId,
    targetUserId: params.targetUserId,
    scope: params.scope,
    reason: params.reason,
    evidence: params.evidence,
    startsAt: params.startsAt ?? now,
    expiresAt: params.expiresAt ?? null,
    liftedAt: null,
    createdAt: now,
    matchedTargets: targets,
    presentation: toActiveBanPresentation(params.reason, params.scope, params.expiresAt ?? null),
  };
};

export const listModerationBans = async (): Promise<ActiveBanMatch[]> => {
  const rows = await db
    .select({
      banId: userBan.id,
      targetUserId: userBan.targetUserId,
      scope: userBan.scope,
      reason: userBan.reason,
      evidence: userBan.evidence,
      startsAt: userBan.startsAt,
      expiresAt: userBan.expiresAt,
      liftedAt: userBan.liftedAt,
      createdAt: userBan.createdAt,
      targetType: banTarget.targetType,
      targetHash: banTarget.targetHash,
    })
    .from(userBan)
    .leftJoin(banTarget, eq(banTarget.banId, userBan.id))
    .orderBy(desc(userBan.createdAt));

  const grouped = new Map<string, BanLookupRow[]>();
  for (const row of rows as BanLookupRow[]) {
    const current = grouped.get(row.banId) ?? [];
    current.push(row);
    grouped.set(row.banId, current);
  }

  return Array.from(grouped.values())
    .map((group) => toBanMatch(group))
    .filter((item): item is ActiveBanMatch => Boolean(item));
};

export const updateBanState = async (params: {
  banId: string;
  expiresAt?: Date | null;
  liftedAt?: Date | null;
  reason?: string;
}): Promise<void> => {
  await db
    .update(userBan)
    .set({
      ...(params.expiresAt !== undefined ? { expiresAt: params.expiresAt } : {}),
      ...(params.liftedAt !== undefined ? { liftedAt: params.liftedAt } : {}),
      ...(params.reason ? { reason: params.reason } : {}),
      updatedAt: new Date(),
    })
    .where(eq(userBan.id, params.banId));
};

export const deleteAuthSessionsForUser = async (userId: string): Promise<void> => {
  await db.delete(session).where(eq(session.userId, userId));
};
