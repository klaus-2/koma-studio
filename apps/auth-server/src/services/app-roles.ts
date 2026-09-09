export type AppRole = "user" | "moderator" | "admin" | "owner";

const APP_ROLES: AppRole[] = ["user", "moderator", "admin", "owner"];

export const normalizeAppRole = (value: unknown): AppRole =>
  typeof value === "string" && APP_ROLES.includes(value as AppRole)
    ? (value as AppRole)
    : "user";

export const isStaffRole = (role: AppRole): boolean =>
  role === "moderator" || role === "admin" || role === "owner";

export const canAccessAdminPanel = (role: AppRole): boolean => isStaffRole(role);

export const canManageBans = (role: AppRole): boolean =>
  role === "admin" || role === "owner";

export const canManageModeration = (role: AppRole): boolean => isStaffRole(role);

export const canManageUsers = (role: AppRole): boolean =>
  role === "admin" || role === "owner";

export const canManageContent = (role: AppRole): boolean =>
  role === "admin" || role === "owner";

export const isOwnerRole = (role: AppRole): boolean => role === "owner";
