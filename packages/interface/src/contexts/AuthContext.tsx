// @koma/auth: single implementation lives in the package; this shim keeps the
// app imports working.
export { AuthProvider, useAuthContext } from "@koma/auth/context";
export type { AuthUser, ActiveBanInfo } from "@koma/auth/context";
