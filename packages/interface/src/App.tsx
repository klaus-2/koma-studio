import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { AuthProvider, useAuthContext } from "./contexts/AuthContext";
import { UpdaterProvider, useUpdaterBlocking } from "./hooks/useUpdater";
import { applyTheme, useThemeStore } from "@koma/ui/stores/theme-store";
import { LegalInlineLinks } from "./components/legal/LegalInlineLinks";
import { getLegalDocumentIdForRoute, isLegalRoutePath } from "./legal/navigation";
import { UpdateToast } from "./components/updater/UpdateToast";
import { MandatoryUpdateGate } from "./components/updater/MandatoryUpdateGate";
import { RuntimeStartupToast } from "./components/runtime/RuntimeStartupToast";
import { CustomCursor } from "./components/CustomCursor";
import { SessionTimeout } from "@koma/auth/SessionTimeout";
import { PageTransition } from "./components/PageTransition";
import { usePageTransition } from "./hooks/usePageTransition";
import { useDiscordRPC } from "./hooks/useDiscordRPC";
import { useDesktopDeepLink } from "./hooks/useDesktopDeepLink";
import { useI18n } from "./i18n";
import {
  type RoutePath,
  parseHashRoute,
  setHashRoute,
  preloadRoute,
  DashboardPage,
  ForgotPasswordPage,
  LoginPage,
  ModelRankingsPage,
  LegalHubPage,
  RegisterPage,
  ResetPasswordPage,
  BannedPage,
  ScanlationFeedPage,
  SettingsPage,
  VerifyEmailPage,
  ConfirmEmailPage,
} from "./app-router";

import { desktopBridge } from "@/lib/desktop-bridge";
const AppShell = () => {
  const { t } = useI18n();
  const [route, setRoute] = useState<RoutePath>(parseHashRoute);
  const routeRef = useRef(route);
  const pendingNavigationRef = useRef(0);
  const { user, isAuthenticated, isLoading, refreshSession, markEmailVerified, activeBan, clearBanState } = useAuthContext();
  const updaterBlocking = useUpdaterBlocking();
  const theme = useThemeStore(
    (s: { theme: import("@koma/ui/stores/theme-store").KomaTheme }) => s.theme,
  );
  const discord = useDiscordRPC(user);
  useDesktopDeepLink();

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  const {
    isActive: isTransitionActive,
    message: transitionMessage,
    start: startOverlayTransition,
    end: endOverlayTransition,
    runNavigation,
  } = usePageTransition({ minDuration: 800 });
  const isDesktopRuntime = desktopBridge.isDesktopRuntime();
  const isProductionEnvironment = import.meta.env.PROD && import.meta.env.MODE !== "e2e";
  const isProductionBrowserRuntime = import.meta.env.PROD && !isDesktopRuntime;
  const showInitialSessionTransition = isLoading && !isProductionBrowserRuntime;
  useEffect(() => {
    routeRef.current = route;
  }, [route]);

  const applyRouteState = useCallback((nextRoute: RoutePath) => {
    routeRef.current = nextRoute;
    setRoute(nextRoute);
  }, []);

  const commitRoute = useCallback((nextRoute: RoutePath) => {
    if (routeRef.current === nextRoute) {
      return false;
    }

    setHashRoute(nextRoute);
    applyRouteState(nextRoute);
    return true;
  }, [applyRouteState]);

  const queueRouteTransition = useCallback(
    (nextRoute: RoutePath, message: string, updateRoute: () => void) => {
      if (routeRef.current === nextRoute) {
        return;
      }

      const navigationId = pendingNavigationRef.current + 1;
      pendingNavigationRef.current = navigationId;

      void preloadRoute(nextRoute)
        .catch(() => undefined)
        .finally(() => {
          if (pendingNavigationRef.current !== navigationId) {
            return;
          }

          runNavigation(() => {
            // Synchronous commit: the new route must be on screen in the same frame
            // the navigation indicator ends, otherwise the previous route flashes.
            flushSync(() => {
              updateRoute();
            });
          }, message);
        });
    },
    [runNavigation],
  );

  const navigateInstant = useCallback(
    (nextRoute: RoutePath) => {
      commitRoute(nextRoute);
    },
    [commitRoute],
  );

  const navigateWithTransition = useCallback(
    (nextRoute: RoutePath, msg = t("app.transition.loading")) => {
      queueRouteTransition(nextRoute, msg, () => {
        commitRoute(nextRoute);
      });
    },
    [commitRoute, queueRouteTransition, t],
  );

  const navigateLogin = useCallback(() => {
    navigateWithTransition("login");
  }, [navigateWithTransition]);

  const navigateRegister = useCallback(() => {
    navigateInstant("register");
  }, [navigateInstant]);

  const navigateForgotPassword = useCallback(() => {
    navigateWithTransition("forgot-password");
  }, [navigateWithTransition]);

  const navigateDashboard = useCallback(() => {
    navigateWithTransition("dashboard");
  }, [navigateWithTransition]);

  const navigateVerifyDashboard = useCallback(() => {
    navigateWithTransition("dashboard");
  }, [navigateWithTransition]);

  const navigateScanlationFeed = useCallback(() => {
    navigateWithTransition("scanlation-feed", t("app.transition.openFeed"));
  }, [navigateWithTransition, t]);

  const navigateModelRankings = useCallback(() => {
    navigateWithTransition("model-rankings", t("app.transition.openRankings"));
  }, [navigateWithTransition, t]);

  const navigateSettings = useCallback(() => {
    navigateWithTransition("settings", t("app.transition.openSettings"));
  }, [navigateWithTransition, t]);

  const handleConfirmNavigateDashboard = useCallback(() => {
    startOverlayTransition(t("app.transition.updateSession"));
    void refreshSession().finally(() => {
      navigateInstant("dashboard");
      endOverlayTransition();
    });
  }, [endOverlayTransition, navigateInstant, refreshSession, startOverlayTransition, t]);

  const handleConfirmSuccess = useCallback(async () => {
    // Optimistic first so the dashboard banner clears even when the session
    // refresh below fails transiently; the refresh then reconciles with the
    // server state.
    markEmailVerified();
    await refreshSession();
  }, [markEmailVerified, refreshSession]);

  const handleBannedBackLogin = useCallback(() => {
    clearBanState();
    navigateLogin();
  }, [clearBanState, navigateLogin]);

  useEffect(() => {
    const onLocationChange = () => {
      const nextRoute = parseHashRoute();

      if (routeRef.current === nextRoute) {
        return;
      }

      if (isProductionBrowserRuntime) {
        applyRouteState(nextRoute);
        return;
      }

      queueRouteTransition(nextRoute, t("app.transition.loading"), () => {
        applyRouteState(nextRoute);
      });
    };

    window.addEventListener("hashchange", onLocationChange);
    window.addEventListener("popstate", onLocationChange);
    return () => {
      window.removeEventListener("hashchange", onLocationChange);
      window.removeEventListener("popstate", onLocationChange);
    };
  }, [applyRouteState, isProductionBrowserRuntime, queueRouteTransition, t]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (activeBan) {
      if (route !== "banned" && !isLegalRoutePath(route)) {
        navigateInstant("banned");
      }
      return;
    }

    if (!isAuthenticated && route !== "login" && route !== "register") {
      if (
        route === "forgot-password" ||
        route === "reset-password" ||
        route === "confirm-email" ||
        isLegalRoutePath(route)
        ) {
        return;
      }
      navigateInstant("login");
      return;
    }

    if (
      isAuthenticated &&
      (route === "login" || route === "register" || route === "forgot-password" || route === "reset-password")
    ) {
      navigateInstant("dashboard");
    }
  }, [activeBan, isAuthenticated, isLoading, navigateInstant, route, updaterBlocking]);

  useEffect(() => {
    if (isLoading || !discord.enabled || !discord.isAvailable) {
      return;
    }

    const syncRoutePresence = async () => {
      switch (route) {
        case "login":
        case "register":
        case "forgot-password":
        case "reset-password":
        case "verify-email":
        case "confirm-email":
          await discord.setPreset("login_register");
          return;
        case "settings":
          await discord.setPreset("settings");
          return;
        case "model-rankings":
          await discord.setPreset("rankings");
          return;
        case "scanlation-feed":
          await discord.setPreset("scanlation_feed");
          return;
        case "dashboard":
          return;
        case "banned":
          if (isAuthenticated) {
            await discord.setDashboard();
          } else {
            await discord.setIdle();
          }
          return;
        default:
          if (isAuthenticated) {
            await discord.setDashboard();
          } else {
            await discord.setIdle();
          }
          return;
      }
    };

    void syncRoutePresence();
  }, [discord, isAuthenticated, isLoading, route]);

  const content = useMemo(() => {
    if (isLoading) {
      return null;
    }

    if (isLegalRoutePath(route)) {
      return <LegalHubPage documentId={getLegalDocumentIdForRoute(route) ?? "terms"} />;
    }

    if (updaterBlocking) {
      return <MandatoryUpdateGate />;
    }

    if (activeBan) {
        return (
          <BannedPage
            ban={activeBan}
            onBackLogin={handleBannedBackLogin}
          />
        );
      }

    if (!isAuthenticated) {
      if (route === "register") {
        return (
          <RegisterPage
            onNavigateLogin={navigateLogin}
            onRegisterSuccess={navigateDashboard}
          />
        );
      }

      if (route === "forgot-password") {
        return (
          <ForgotPasswordPage
            onNavigateLogin={navigateLogin}
          />
        );
      }

      if (route === "reset-password") {
        return (
          <ResetPasswordPage
            onNavigateLogin={navigateLogin}
          />
        );
      }

      if (route === "confirm-email") {
        return (
          <ConfirmEmailPage
            onNavigateDashboard={handleConfirmNavigateDashboard}
            onNavigateLogin={navigateLogin}
            onConfirmSuccess={handleConfirmSuccess}
          />
        );
      }

      return (
        <LoginPage
          onNavigateRegister={navigateRegister}
          onNavigateForgotPassword={navigateForgotPassword}
          onLoginSuccess={navigateDashboard}
        />
      );
    }

    if (route === "verify-email") {
      return (
        <VerifyEmailPage
          onBackDashboard={navigateVerifyDashboard}
        />
      );
    }

    if (route === "confirm-email") {
      return (
        <ConfirmEmailPage
          onNavigateDashboard={handleConfirmNavigateDashboard}
          onNavigateLogin={navigateLogin}
          onConfirmSuccess={handleConfirmSuccess}
        />
      );
    }

    if (route === "scanlation-feed") {
      return (
        <ScanlationFeedPage
          onBackDashboard={navigateDashboard}
        />
      );
    }

    if (route === "model-rankings") {
      return (
        <ModelRankingsPage
          onBackDashboard={navigateDashboard}
        />
      );
    }

    if (route === "settings") {
      return (
        <SettingsPage
          onBackDashboard={navigateDashboard}
        />
      );
    }

    return (
      <DashboardPage
        onOpenScanlationFeed={navigateScanlationFeed}
        onOpenModelRankings={navigateModelRankings}
        onOpenSettings={navigateSettings}
      />
    );
  }, [
    activeBan,
    handleBannedBackLogin,
    handleConfirmNavigateDashboard,
    handleConfirmSuccess,
    isAuthenticated,
    isLoading,
    navigateDashboard,
    navigateForgotPassword,
    navigateLogin,
    navigateModelRankings,
    navigateRegister,
    navigateScanlationFeed,
    navigateSettings,
    navigateVerifyDashboard,
    route,
    updaterBlocking,
  ]);

  if (isProductionEnvironment && !isDesktopRuntime) {
    if (isLegalRoutePath(route)) {
      return (
        <Suspense fallback={<div className="koma-route-shell__fallback" aria-hidden="true" />}>
          <LegalHubPage documentId={getLegalDocumentIdForRoute(route) ?? "terms"} />
        </Suspense>
      );
    }

    return (
      <>
        <div className="koma-app-restricted">
          <div className="koma-app-restricted__card">
            <h1 className="koma-app-restricted__title">{t("app.restricted.title")}</h1>
            <p className="koma-app-restricted__text">
              {t("app.restricted.description")}
            </p>
            <p className="koma-app-restricted__text">
              {t("app.restricted.publicDocs")}
              <span className="koma-legal-inline">
                <LegalInlineLinks includeContentPolicy />
              </span>
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageTransition
        active={showInitialSessionTransition || isTransitionActive}
        message={showInitialSessionTransition ? t("app.session.validating") : transitionMessage}
        variant={showInitialSessionTransition ? "minimal" : "default"}
      />
      <div className="koma-route-shell" data-route={route}>
        <Suspense fallback={<div className="koma-route-shell__fallback" aria-hidden="true" />}>
          {content}
        </Suspense>
      </div>
      <SessionTimeout />
      <RuntimeStartupToast />
      <UpdateToast />
    </>
  );
};

const App = () => (
  <UpdaterProvider>
    <AuthProvider>
      <CustomCursor />
      <AppShell />
    </AuthProvider>
  </UpdaterProvider>
);

export default App;
