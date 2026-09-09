import { lazy } from "react";
import { type LegalRoutePath, isLegalRoutePath } from "./legal/navigation";

const loadDashboardPage = () => import("./pages/Dashboard");
const loadForgotPasswordPage = () => import("./pages/ForgotPassword");
const loadLoginPage = () => import("./pages/Login");
const loadModelRankingsPage = () => import("./pages/ModelRankings");
const loadLegalHubPage = () => import("./pages/LegalHub");
const loadRegisterPage = () => import("./pages/Register");
const loadResetPasswordPage = () => import("./pages/ResetPassword");
const loadBannedPage = () => import("./pages/Banned");
const loadScanlationFeedPage = () => import("./pages/ScanlationFeed");
const loadSettingsPage = () => import("./pages/Settings");
const loadVerifyEmailPage = () => import("./pages/VerifyEmail");
const loadConfirmEmailPage = () => import("./pages/ConfirmEmail");

export const DashboardPage = lazy(() => loadDashboardPage().then((module) => ({ default: module.DashboardPage })));
export const ForgotPasswordPage = lazy(() => loadForgotPasswordPage().then((module) => ({ default: module.ForgotPasswordPage })));
export const LoginPage = lazy(() => loadLoginPage().then((module) => ({ default: module.LoginPage })));
export const ModelRankingsPage = lazy(() => loadModelRankingsPage().then((module) => ({ default: module.ModelRankingsPage })));
export const LegalHubPage = lazy(() => loadLegalHubPage().then((module) => ({ default: module.LegalHubPage })));
export const RegisterPage = lazy(() => loadRegisterPage().then((module) => ({ default: module.RegisterPage })));
export const ResetPasswordPage = lazy(() => loadResetPasswordPage().then((module) => ({ default: module.ResetPasswordPage })));
export const BannedPage = lazy(() => loadBannedPage().then((module) => ({ default: module.BannedPage })));
export const ScanlationFeedPage = lazy(() => loadScanlationFeedPage().then((module) => ({ default: module.ScanlationFeedPage })));
export const SettingsPage = lazy(() => loadSettingsPage().then((module) => ({ default: module.SettingsPage })));
export const VerifyEmailPage = lazy(() => loadVerifyEmailPage().then((module) => ({ default: module.VerifyEmailPage })));
export const ConfirmEmailPage = lazy(() => loadConfirmEmailPage().then((module) => ({ default: module.ConfirmEmailPage })));

export type RoutePath =
  | "login"
  | "register"
  | "forgot-password"
  | "reset-password"
  | "verify-email"
  | "confirm-email"
  | "dashboard"
  | "scanlation-feed"
  | "model-rankings"
  | "settings"
  | "banned"
  | LegalRoutePath;

export const preloadRoute = (route: RoutePath): Promise<unknown> => {
  switch (route) {
    case "dashboard":
      return loadDashboardPage();
    case "forgot-password":
      return loadForgotPasswordPage();
    case "login":
      return loadLoginPage();
    case "model-rankings":
      return loadModelRankingsPage();
    case "register":
      return loadRegisterPage();
    case "reset-password":
      return loadResetPasswordPage();
    case "banned":
      return loadBannedPage();
    case "scanlation-feed":
      return loadScanlationFeedPage();
    case "settings":
      return loadSettingsPage();
    case "verify-email":
      return loadVerifyEmailPage();
    case "confirm-email":
      return loadConfirmEmailPage();
    default:
      if (isLegalRoutePath(route)) {
        return loadLegalHubPage();
      }
      return Promise.resolve();
  }
};

export const parseHashRoute = (): RoutePath => {
  const searchParams = new URLSearchParams(window.location.search);
  if (searchParams.get("token")) {
    return "reset-password";
  }

  const hash = window.location.hash.replace(/^#\/?/, "").toLowerCase();
  const routeSegment = hash.split("?")[0];
  if (
    routeSegment === "login" ||
    routeSegment === "register" ||
    routeSegment === "forgot-password" ||
    routeSegment === "reset-password" ||
    routeSegment === "verify-email" ||
    routeSegment === "confirm-email" ||
    routeSegment === "dashboard" ||
    routeSegment === "scanlation-feed" ||
    routeSegment === "model-rankings" ||
    routeSegment === "settings" ||
    routeSegment === "banned"
  ) {
    return routeSegment;
  }

  if (routeSegment && isLegalRoutePath(routeSegment)) {
    return routeSegment;
  }

  return "dashboard";
};

export const setHashRoute = (route: RoutePath): void => {
  window.location.hash = `/${route}`;
};
