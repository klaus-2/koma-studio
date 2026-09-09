/**
 * LLM profiles management module.
 * Extracted from electron/main.ts during God File decomposition.
 */
import { app, safeStorage } from "electron";
import path from "node:path";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { registerSecureIpcHandler } from "./shared.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DesktopLlmProfileRecord {
  id: string;
  stage: "translation" | "ocr";
  label: string;
  apiBase: string;
  apiKey: string;
  model: string;
  createdAt: string;
  updatedAt: string;
}

interface DesktopLlmProfilesEnvelope {
  encrypted: boolean;
  payload: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DESKTOP_LLM_PROFILE_STAGES = new Set(["translation", "ocr", "clean"]);
const GUEST_DESKTOP_LLM_PROFILE_SCOPE = "__guest__";
const SHARED_DESKTOP_LLM_PROFILE_SCOPE = "__shared__";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ensureDesktopSecretsDir = (): string => {
  const secretsDir = path.join(app.getPath("userData"), "secure-store");
  fs.mkdirSync(secretsDir, { recursive: true });
  return secretsDir;
};

const sanitizeDesktopLlmProfileText = (value: unknown, maxLength: number): string =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";

const sanitizeDesktopLlmProfileUserId = (value: unknown): string =>
  sanitizeDesktopLlmProfileText(value, 256);

const resolveDesktopLlmProfileUserId = (value: unknown): string =>
  sanitizeDesktopLlmProfileUserId(value) || GUEST_DESKTOP_LLM_PROFILE_SCOPE;

const getDesktopLlmProfilesPath = (userId?: string | null): string => {
  const normalizedUserId = resolveDesktopLlmProfileUserId(userId);
  if (!normalizedUserId) {
    return path.join(ensureDesktopSecretsDir(), "llm-profiles.json");
  }

  const hashedUserId = createHash("sha256").update(normalizedUserId).digest("hex");
  return path.join(ensureDesktopSecretsDir(), `llm-profiles.${hashedUserId}.json`);
};

const mergeDesktopLlmProfiles = (
  ...collections: DesktopLlmProfileRecord[][]
): DesktopLlmProfileRecord[] => {
  const byId = new Map<string, DesktopLlmProfileRecord>();
  for (const collection of collections) {
    for (const profile of collection) {
      const current = byId.get(profile.id);
      if (!current) {
        byId.set(profile.id, profile);
        continue;
      }
      const currentTime = Date.parse(current.updatedAt || current.createdAt || "");
      const nextTime = Date.parse(profile.updatedAt || profile.createdAt || "");
      if (Number.isNaN(currentTime) || (!Number.isNaN(nextTime) && nextTime >= currentTime)) {
        byId.set(profile.id, profile);
      }
    }
  }
  return Array.from(byId.values()).sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));
};

const sanitizeDesktopLlmUrl = (value: unknown): string =>
  typeof value === "string" ? value.trim().replace(/\s+/g, "") : "";

const sanitizeDesktopLlmApiKey = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const sanitizeDesktopLlmProfile = (value: unknown): DesktopLlmProfileRecord | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as Record<string, unknown>;
  const stage =
    typeof payload.stage === "string" && DESKTOP_LLM_PROFILE_STAGES.has(payload.stage)
      ? (payload.stage as DesktopLlmProfileRecord["stage"])
      : null;
  const id = sanitizeDesktopLlmProfileText(payload.id, 128);
  const label = sanitizeDesktopLlmProfileText(payload.label, 80);
  const apiBase = sanitizeDesktopLlmUrl(payload.apiBase);
  const apiKey = sanitizeDesktopLlmApiKey(payload.apiKey);
  const model = sanitizeDesktopLlmProfileText(payload.model, 200);
  const createdAt =
    typeof payload.createdAt === "string" && payload.createdAt.trim().length > 0
      ? payload.createdAt
      : new Date().toISOString();
  const updatedAt =
    typeof payload.updatedAt === "string" && payload.updatedAt.trim().length > 0
      ? payload.updatedAt
      : createdAt;

  if (!stage || !id || !label || !apiBase || !model) {
    return null;
  }

  try {
    const parsed = new URL(apiBase);
    if (!/^https?:$/i.test(parsed.protocol)) {
      return null;
    }
  } catch {
    return null;
  }

  return {
    id,
    stage,
    label,
    apiBase,
    apiKey,
    model,
    createdAt,
    updatedAt,
  };
};

const serializeDesktopLlmProfiles = (
  profiles: DesktopLlmProfileRecord[],
): DesktopLlmProfilesEnvelope => {
  const payload = JSON.stringify(profiles);
  if (safeStorage.isEncryptionAvailable()) {
    return {
      encrypted: true,
      payload: safeStorage.encryptString(payload).toString("base64"),
    };
  }

  return {
    encrypted: false,
    payload,
  };
};

const parseDesktopLlmProfiles = (raw: string): DesktopLlmProfileRecord[] => {
  if (!raw.trim()) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (Array.isArray(parsed)) {
    return parsed
      .map((item) => sanitizeDesktopLlmProfile(item))
      .filter((item): item is DesktopLlmProfileRecord => Boolean(item));
  }

  if (!parsed || typeof parsed !== "object") {
    return [];
  }

  const envelope = parsed as Partial<DesktopLlmProfilesEnvelope>;
  if (typeof envelope.payload !== "string") {
    return [];
  }

  let decrypted = envelope.payload;
  if (envelope.encrypted) {
    if (!safeStorage.isEncryptionAvailable()) {
      return [];
    }

    try {
      decrypted = safeStorage.decryptString(Buffer.from(envelope.payload, "base64"));
    } catch {
      return [];
    }
  }

  return parseDesktopLlmProfiles(decrypted);
};

const readDesktopLlmProfilesFromPath = (filePath: string): DesktopLlmProfileRecord[] => {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return parseDesktopLlmProfiles(raw);
  } catch {
    return [];
  }
};

const readDesktopLlmProfiles = (userId?: string | null): DesktopLlmProfileRecord[] => {
  const normalizedUserId = resolveDesktopLlmProfileUserId(userId);
  const scopedPath = getDesktopLlmProfilesPath(normalizedUserId);
  const sharedPath = getDesktopLlmProfilesPath(SHARED_DESKTOP_LLM_PROFILE_SCOPE);
  const guestPath = getDesktopLlmProfilesPath(GUEST_DESKTOP_LLM_PROFILE_SCOPE);

  const scopedProfiles = readDesktopLlmProfilesFromPath(scopedPath);
  const sharedProfiles = normalizedUserId === SHARED_DESKTOP_LLM_PROFILE_SCOPE
    ? []
    : readDesktopLlmProfilesFromPath(sharedPath);
  const guestProfiles = normalizedUserId === GUEST_DESKTOP_LLM_PROFILE_SCOPE
    ? []
    : readDesktopLlmProfilesFromPath(guestPath);

  const mergedProfiles = mergeDesktopLlmProfiles(
    sharedProfiles,
    guestProfiles,
    scopedProfiles,
  );

  if (
    normalizedUserId !== GUEST_DESKTOP_LLM_PROFILE_SCOPE
    && normalizedUserId !== SHARED_DESKTOP_LLM_PROFILE_SCOPE
    && mergedProfiles.length > 0
    && scopedProfiles.length !== mergedProfiles.length
  ) {
    writeDesktopLlmProfiles(mergedProfiles, normalizedUserId);
  }

  return mergedProfiles;
};

const writeDesktopLlmProfiles = (
  profiles: DesktopLlmProfileRecord[],
  userId?: string | null,
): boolean => {
  const normalizedUserId = resolveDesktopLlmProfileUserId(userId);
  const mergedProfiles = mergeDesktopLlmProfiles(profiles);
  const envelope = serializeDesktopLlmProfiles(mergedProfiles);
  fs.writeFileSync(getDesktopLlmProfilesPath(normalizedUserId), JSON.stringify(envelope, null, 2), "utf8");
  if (normalizedUserId !== SHARED_DESKTOP_LLM_PROFILE_SCOPE) {
    fs.writeFileSync(
      getDesktopLlmProfilesPath(SHARED_DESKTOP_LLM_PROFILE_SCOPE),
      JSON.stringify(envelope, null, 2),
      "utf8",
    );
  }
  return envelope.encrypted;
};

const listDesktopLlmProfiles = (userId: string): { profiles: DesktopLlmProfileRecord[]; secureStorage: boolean } => ({
  profiles: readDesktopLlmProfiles(userId).sort((left, right) => left.label.localeCompare(right.label, "pt-BR")),
  secureStorage: safeStorage.isEncryptionAvailable(),
});

const upsertDesktopLlmProfile = (
  value: unknown,
): { profiles: DesktopLlmProfileRecord[]; profile: DesktopLlmProfileRecord; secureStorage: boolean } => {
  const payload = (value ?? {}) as Record<string, unknown>;
  const userId = resolveDesktopLlmProfileUserId(payload.userId);

  const profile = sanitizeDesktopLlmProfile(payload.profile);
  if (!profile) {
    throw new Error("Invalid custom LLM profile.");
  }

  const current = readDesktopLlmProfiles(userId);
  const previous = current.find((item) => item.id === profile.id) ?? null;
  const now = new Date().toISOString();
  const nextProfile: DesktopLlmProfileRecord = {
    ...profile,
    createdAt: previous?.createdAt ?? profile.createdAt ?? now,
    updatedAt: now,
  };
  const nextProfiles = [
    ...current.filter((item) => item.id !== nextProfile.id),
    nextProfile,
  ].sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));
  const secureStorage = writeDesktopLlmProfiles(nextProfiles, userId);

  return {
    profiles: nextProfiles,
    profile: nextProfile,
    secureStorage,
  };
};

const removeDesktopLlmProfile = (
  value: unknown,
): { profiles: DesktopLlmProfileRecord[]; secureStorage: boolean } => {
  const payload = (value ?? {}) as Record<string, unknown>;
  const userId = resolveDesktopLlmProfileUserId(payload.userId);

  const profileId = sanitizeDesktopLlmProfileText(payload.profileId, 128);
  if (!profileId) {
    throw new Error("Custom profile missing.");
  }

  const nextProfiles = readDesktopLlmProfiles(userId).filter((profile) => profile.id !== profileId);
  const secureStorage = writeDesktopLlmProfiles(nextProfiles, userId);
  return {
    profiles: nextProfiles,
    secureStorage,
  };
};

// ---------------------------------------------------------------------------
// IPC handler setup
// ---------------------------------------------------------------------------

const setupDesktopLlmProfilesIpcHandlers = (): void => {
  registerSecureIpcHandler<{
    profiles: DesktopLlmProfileRecord[];
    secureStorage: boolean;
  }>("desktop-api:llm-profiles:list", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    const userId = resolveDesktopLlmProfileUserId(payload.userId);
    return listDesktopLlmProfiles(userId);
  });

  registerSecureIpcHandler<{
    profiles: DesktopLlmProfileRecord[];
    profile: DesktopLlmProfileRecord;
    secureStorage: boolean;
  }>("desktop-api:llm-profiles:save", async (value) => {
    return upsertDesktopLlmProfile(value);
  });

  registerSecureIpcHandler<{
    profiles: DesktopLlmProfileRecord[];
    secureStorage: boolean;
  }>("desktop-api:llm-profiles:remove", async (value) => {
    return removeDesktopLlmProfile(value);
  });
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  type DesktopLlmProfileRecord,
  type DesktopLlmProfilesEnvelope,
  DESKTOP_LLM_PROFILE_STAGES,
  GUEST_DESKTOP_LLM_PROFILE_SCOPE,
  SHARED_DESKTOP_LLM_PROFILE_SCOPE,
  ensureDesktopSecretsDir,
  sanitizeDesktopLlmProfileText,
  sanitizeDesktopLlmProfileUserId,
  resolveDesktopLlmProfileUserId,
  getDesktopLlmProfilesPath,
  mergeDesktopLlmProfiles,
  sanitizeDesktopLlmUrl,
  sanitizeDesktopLlmApiKey,
  sanitizeDesktopLlmProfile,
  serializeDesktopLlmProfiles,
  parseDesktopLlmProfiles,
  readDesktopLlmProfilesFromPath,
  readDesktopLlmProfiles,
  writeDesktopLlmProfiles,
  listDesktopLlmProfiles,
  upsertDesktopLlmProfile,
  removeDesktopLlmProfile,
  setupDesktopLlmProfilesIpcHandlers,
};
