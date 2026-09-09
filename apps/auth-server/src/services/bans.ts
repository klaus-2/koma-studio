export type BanScopePreset =
  | "account_only"
  | "account_hwid"
  | "account_hwid_mac_ip";

export type BanTargetType =
  | "account"
  | "desktop_hwid"
  | "desktop_mac"
  | "ip_subnet";

export interface BanIdentityRecord {
  identityType: Exclude<BanTargetType, "account">;
  identityHash: string;
}

export interface BanTargetRecord {
  targetType: BanTargetType;
  targetHash: string;
}

export interface BanCheckSignals {
  userId?: string | null;
  desktopHwidHmac?: string | null;
  desktopMacHmac?: string | null;
  ipSubnetHmac?: string | null;
}

export interface ActiveBanWindow {
  startsAt: Date | null;
  expiresAt: Date | null;
  liftedAt: Date | null;
}

export interface BanPresentationInput {
  reason: string;
  expiresAt: Date | null;
  scope: BanScopePreset;
}

const dedupeBanTargets = (targets: BanTargetRecord[]): BanTargetRecord[] => {
  const seen = new Set<string>();
  return targets.filter((target) => {
    const key = `${target.targetType}:${target.targetHash}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

export const collectBanTargetHashes = (
  scope: BanScopePreset,
  userId: string,
  identities: BanIdentityRecord[],
): BanTargetRecord[] => {
  const targets: BanTargetRecord[] = [{ targetType: "account", targetHash: userId }];
  const identityMap = new Map(identities.map((item) => [item.identityType, item.identityHash]));

  if (scope === "account_hwid" || scope === "account_hwid_mac_ip") {
    const hwid = identityMap.get("desktop_hwid");
    if (hwid) {
      targets.push({ targetType: "desktop_hwid", targetHash: hwid });
    }
  }

  if (scope === "account_hwid_mac_ip") {
    const mac = identityMap.get("desktop_mac");
    const ip = identityMap.get("ip_subnet");
    if (mac) {
      targets.push({ targetType: "desktop_mac", targetHash: mac });
    }
    if (ip) {
      targets.push({ targetType: "ip_subnet", targetHash: ip });
    }
  }

  return dedupeBanTargets(targets);
};

export const banMatchesSignals = (
  target: BanTargetRecord,
  signals: BanCheckSignals,
): boolean => {
  switch (target.targetType) {
    case "account":
      return Boolean(signals.userId && target.targetHash === signals.userId);
    case "desktop_hwid":
      return Boolean(signals.desktopHwidHmac && target.targetHash === signals.desktopHwidHmac);
    case "desktop_mac":
      return Boolean(signals.desktopMacHmac && target.targetHash === signals.desktopMacHmac);
    case "ip_subnet":
      return Boolean(signals.ipSubnetHmac && target.targetHash === signals.ipSubnetHmac);
    default:
      return false;
  }
};

export const isBanActive = (
  window: ActiveBanWindow,
  now: Date = new Date(),
): boolean => {
  if (window.liftedAt && window.liftedAt.getTime() <= now.getTime()) {
    return false;
  }
  if (window.startsAt && window.startsAt.getTime() > now.getTime()) {
    return false;
  }
  if (window.expiresAt && window.expiresAt.getTime() <= now.getTime()) {
    return false;
  }
  return true;
};

export const getBanPresentation = (input: BanPresentationInput): {
  title: string;
  detail: string;
  temporary: boolean;
} => {
  const temporary = Boolean(input.expiresAt);
  const scopeLabel =
    input.scope === "account_only"
      ? "account"
      : input.scope === "account_hwid"
        ? "account and device"
        : "account, device, and network";
  const expirationLabel = input.expiresAt
    ? ` until ${input.expiresAt.toISOString()}`
    : "";

  return {
    title: "Access blocked",
    detail: `${input.reason} Scope: ${scopeLabel}.${expirationLabel}`,
    temporary,
  };
};
