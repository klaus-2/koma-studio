import { randomUUID } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";

import { auth } from "../auth/config.js";
import { buildAuthForwardHeaders } from "../auth/forward-headers.js";
import { authenticateBearerToken, issueAccessToken } from "../auth/middleware.js";
import { normalizeEmail, sanitizeName } from "../auth/validators.js";
import { env, isWebRequest } from "../config/env.js";
import { db } from "../db/client.js";
import { legalAcceptance, user } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { parseLegalAcceptancePayload } from "../legal/acceptance.js";
import {
  clearFailedLoginAttempts,
  clearUserLock,
  detectLoginAnomaly,
  findUserByEmail,
  increaseFailedLoginAttempts,
  isUserLocked,
  lockUserForBruteForce,
  recordSecurityLog,
  updateUserLoginMeta,
} from "../security/anomaly.js";
import { getClientIp } from "../security/client-ip.js";
import { validatePassword } from "../security/password.js";
import {
  assertRegistrationAllowed,
  extractDesktopRegistrationSignals,
  isRegistrationIdentityConflictError,
  persistRegistrationIdentity,
} from "../security/registration-guard.js";
import {
  dashboardLaunchLimiter,
  forgotPasswordLimiter,
  loginLimiter,
  registerLimiter,
  resetPasswordLimiter,
} from "../security/rate-limiter.js";
import {
  forgotPasswordValidation,
  handleValidationErrors,
  loginValidation,
  resetPasswordValidation,
  registerValidation,
} from "../security/waf.js";
import { isEmailDeliveryEnabled } from "../services/email.js";
import { buildBanCheckSignalsForRequest, findActiveBanForSignals } from "../services/ban-enforcement.js";
import { resolveLocaleFromHeaders, tServer } from "../services/server-i18n.js";
import { logger } from "../utils/logger.js";

import type { AuthUserResponsePayload } from "./_shared.js";

import {
  appendHeaders,
  asObject,
  bootstrapOwnerRoleIfNeeded,
  BRUTE_FORCE_LOCK_MINUTES,
  BRUTE_FORCE_LOCK_THRESHOLD,
  buildAuthenticatedUserResponse,
  buildNormalizedAuthErrorBody,
  detectRequestLocale,
  enforceMandatoryUpdateIfNeeded,
  getRequestDesktopDeviceId,
  getRequestDesktopMacFingerprint,
  getUserById,
  jsonParser,
  makeAuthUserResponse,
  betterAuthHandler,
  parseJsonSafely,
  requireNoActiveBan,
  resolveSessionId,
  resolveSessionUser,
  sendActiveBanResponse,
  sendAuthError,
  sendNormalizedAuthApiError,
  syncUserLocaleIfNeeded,
  urlEncodedParser,
} from "./_shared.js";

export function registerAuthRoutes(app: express.Express): void {
    app.get("/api/auth/config", (_req: Request, res: Response) => {
      return res.status(200).json({
        captchaEnabled: Boolean(env.turnstileSiteKey && env.turnstileSecretKey),
        turnstileSiteKey: env.turnstileSiteKey ?? null,
        emailDeliveryEnabled: isEmailDeliveryEnabled(),
        desktopClientEnforced: env.enforceDesktopClient && !env.devWebLoginAllowed,
      });
    });

    app.post(
      "/api/auth/register",
      jsonParser,
      urlEncodedParser,
      registerLimiter,
      registerValidation,
      handleValidationErrors,
      async (req: Request, res: Response, next: NextFunction) => {
        const body = asObject(req.body);
        if (!body) {
          return sendAuthError(
            res,
            400,
            { error: tServer(resolveLocaleFromHeaders(req.headers), "auth.error.requestBodyInvalid") },
          );
        }

        const email = normalizeEmail(String(body.email ?? ""));
        const password = String(body.password ?? "");
        const name = sanitizeName(typeof body.name === "string" ? body.name : undefined);
        const desktopSignalValidation = extractDesktopRegistrationSignals(req, body);
        const parsedLegalAcceptance = parseLegalAcceptancePayload(
          body.legalAcceptance,
          resolveLocaleFromHeaders(req.headers),
        );
        const ipAddress = getClientIp(req);
        const userAgent = String(req.headers["user-agent"] ?? "unknown");
        const requestBan = await findActiveBanForSignals(
          buildBanCheckSignalsForRequest(req, {
            desktopDeviceId: getRequestDesktopDeviceId(req, body),
            desktopMacFingerprint: getRequestDesktopMacFingerprint(body),
          }),
        );
        if (requestBan) {
          return sendActiveBanResponse(res, "/api/auth/register", requestBan);
        }
        let registrationIdentityHashes:
          | {
              desktopHwidHmac: string;
              desktopMacHmac: string;
              ipSubnetHmac: string;
            }
          | null = null;

        if (!parsedLegalAcceptance.ok) {
          return sendAuthError(res, 400, { error: parsedLegalAcceptance.error });
        }

        const blockMultiAccountRegistration = async (
          signal: "desktop_hwid" | "desktop_mac" | "ip_subnet",
          conflictingUserId?: string,
        ): Promise<Response> => {

          if (conflictingUserId) {
            await recordSecurityLog(
              conflictingUserId,
              "register_blocked_multi_account",
              "warning",
              ipAddress,
              userAgent,
              { signal },
            );
          }

          return sendAuthError(
            res,
            403,
            {
              error: tServer(resolveLocaleFromHeaders(req.headers), "auth.error.multiAccountBlocked"),
              code: "AUTH_MULTI_ACCOUNT_BLOCKED",
            },
          );
        };

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
          return sendAuthError(
            res,
            400,
            {
              error: tServer(resolveLocaleFromHeaders(req.headers), "auth.error.passwordInvalid"),
              details: passwordValidation.errors,
            },
          );
        }

        const desktopRegistrationEnforced =
          env.enforceDesktopRegistration && !(env.devWebLoginAllowed && isWebRequest(req));
        if (desktopRegistrationEnforced) {
          if (!desktopSignalValidation.ok) {
            return sendAuthError(
              res,
              403,
              {
                error:
                  desktopSignalValidation.error === "missing"
                    ? tServer(resolveLocaleFromHeaders(req.headers), "auth.error.desktopIdentityRequired")
                    : tServer(resolveLocaleFromHeaders(req.headers), "auth.error.desktopIdentityInvalid"),
                code:
                  desktopSignalValidation.error === "missing"
                    ? "AUTH_DESKTOP_IDENTITY_REQUIRED"
                    : "AUTH_DESKTOP_IDENTITY_INVALID",
              },
            );
          }

          registrationIdentityHashes = {
            desktopHwidHmac: desktopSignalValidation.signals.desktopHwidHmac,
            desktopMacHmac: desktopSignalValidation.signals.desktopMacHmac,
            ipSubnetHmac: desktopSignalValidation.signals.ipSubnetHmac,
          };

          const registrationAllowed = await assertRegistrationAllowed(registrationIdentityHashes);
          if (!registrationAllowed.allowed) {
            return blockMultiAccountRegistration(
              registrationAllowed.signal,
              registrationAllowed.conflictingUserId,
            );
          }
        }

        const requestLocale = detectRequestLocale(req, body);

        try {
          const response = await auth.api.signUpEmail({
            headers: buildAuthForwardHeaders(req.headers),
            body: {
              email,
              password,
              name:
                name ||
                email.split("@")[0] ||
                tServer(resolveLocaleFromHeaders(req.headers), "auth.error.fallbackUserName"),
              locale: requestLocale ?? undefined,
            },
            asResponse: true,
          });

          if (!response.ok) {
            const responsePayload = await parseJsonSafely(response);
            return sendAuthError(
              res,
              response.status,
              buildNormalizedAuthErrorBody(responsePayload, {
                fallbackError: tServer(resolveLocaleFromHeaders(req.headers), "auth.register.finalizeFailed"),
                locale: resolveLocaleFromHeaders(req.headers),
              })
            );
          }

          const payload = await parseJsonSafely(response);
          const createdUserId =
            resolveSessionUser(payload)?.id ?? (await findUserByEmail(email))?.id ?? null;

          if (!createdUserId) {
            return sendAuthError(
              res,
              500,
              {
                error: tServer(resolveLocaleFromHeaders(req.headers), "auth.register.finalizeFailed"),
              },
            );
          }

          try {
            await db.insert(legalAcceptance).values({
              id: randomUUID(),
              userId: createdUserId,
              source: "register",
              termsVersion: parsedLegalAcceptance.value.termsVersion,
              privacyVersion: parsedLegalAcceptance.value.privacyVersion,
              cookiesVersion: parsedLegalAcceptance.value.cookiesVersion,
              contentVersion: parsedLegalAcceptance.value.contentVersion,
              ipAddress,
              userAgent,
              metadata: {
                route: "/api/auth/register",
                desktopRegistration: Boolean(registrationIdentityHashes),
              },
            });
            await recordSecurityLog(
              createdUserId,
              "legal_acceptance_recorded",
              "info",
              ipAddress,
              userAgent,
              {
                source: "register",
                termsVersion: parsedLegalAcceptance.value.termsVersion,
                privacyVersion: parsedLegalAcceptance.value.privacyVersion,
              },
            );
          } catch (error) {
            try {
              await db.delete(user).where(eq(user.id, createdUserId));
            } catch (deleteError) {
              logger.error("failed_to_delete_user_after_legal_acceptance_error", {
                userId: createdUserId,
                error:
                  deleteError instanceof Error
                    ? { message: deleteError.message, stack: deleteError.stack }
                    : deleteError,
              });
            }

            logger.error("failed_to_persist_legal_acceptance", {
              userId: createdUserId,
              error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
            });

            return sendAuthError(
              res,
              500,
              {
                error: tServer(resolveLocaleFromHeaders(req.headers), "auth.register.legalAcceptanceFailed"),
              },
            );
          }

          if (registrationIdentityHashes) {
            try {
              await persistRegistrationIdentity(createdUserId, registrationIdentityHashes);
              await bootstrapOwnerRoleIfNeeded(createdUserId);
              await recordSecurityLog(
                createdUserId,
                "register_identity_linked",
                "info",
                ipAddress,
                userAgent,
                {
                  identityTypes: ["desktop_hwid", "desktop_mac", "ip_subnet"],
                },
              );
            } catch (error) {
              if (isRegistrationIdentityConflictError(error)) {
                try {
                  await db.delete(user).where(eq(user.id, createdUserId));
                } catch (deleteError) {
                  logger.error("failed_to_delete_user_after_registration_identity_conflict", {
                    userId: createdUserId,
                    error:
                      deleteError instanceof Error
                        ? { message: deleteError.message, stack: deleteError.stack }
                        : deleteError,
                  });
                }

                const conflict = await assertRegistrationAllowed(registrationIdentityHashes);
                const signal = conflict.allowed ? error.signal : conflict.signal;
                const conflictingUserId = conflict.allowed ? undefined : conflict.conflictingUserId;
                return blockMultiAccountRegistration(signal, conflictingUserId);
              }

              throw error;
            }
          } else {
            await bootstrapOwnerRoleIfNeeded(createdUserId);
          }

          appendHeaders(response.headers, res);
          return res.status(201).json({
            success: true,
            message: tServer(resolveLocaleFromHeaders(req.headers), "auth.register.success"),
          });
        } catch (error) {
          return next(error);
        }
      },
    );

    app.post(
      "/api/auth/login",
      jsonParser,
      urlEncodedParser,
      loginLimiter,
      loginValidation,
      handleValidationErrors,
      async (req: Request, res: Response, next: NextFunction) => {
        const body = asObject(req.body);
        if (!body) {
          return sendAuthError(
            res,
            400,
            { error: tServer(resolveLocaleFromHeaders(req.headers), "auth.error.requestBodyInvalid") },
          );
        }

        const email = normalizeEmail(String(body.email ?? ""));
        const password = String(body.password ?? "");
        const rememberMe = body.rememberMe === true;
        const ipAddress = getClientIp(req);
        const userAgent = req.headers["user-agent"] ?? "unknown";

        try {
          const requestLocale = detectRequestLocale(req, body);
          if (await enforceMandatoryUpdateIfNeeded(req, res, "/api/auth/login")) {
            return;
          }

          const existingUser = await findUserByEmail(email);
          const requestBan = await findActiveBanForSignals(
            buildBanCheckSignalsForRequest(req, {
              userId: existingUser?.id ?? null,
              desktopDeviceId: getRequestDesktopDeviceId(req, body),
              desktopMacFingerprint: getRequestDesktopMacFingerprint(body),
            }),
          );
          if (requestBan) {
            return sendActiveBanResponse(res, "/api/auth/login", requestBan);
          }
          if (existingUser && isUserLocked(existingUser.accountLockedUntil)) {
            return sendAuthError(
              res,
              423,
              {
                error: tServer(resolveLocaleFromHeaders(req.headers), "auth.error.accountLockedAttempts"),
                code: "AUTH_ACCOUNT_LOCKED",
                retryAt: existingUser.accountLockedUntil,
              }
            );
          }

          const response = await auth.api.signInEmail({
            headers: buildAuthForwardHeaders(req.headers),
            body: {
              email,
              password,
              rememberMe,
            },
            asResponse: true,
          });

          appendHeaders(response.headers, res);

          if (!response.ok) {
            const responsePayload = await parseJsonSafely(response);
            const normalizedAuthError = buildNormalizedAuthErrorBody(responsePayload, {
              fallbackError: tServer(resolveLocaleFromHeaders(req.headers), "auth.error.invalidCredentials"),
              fallbackCode: "AUTH_INVALID_CREDENTIALS",
              locale: resolveLocaleFromHeaders(req.headers),
            });
            const attempts = await increaseFailedLoginAttempts(email, ipAddress);

            if (existingUser?.id) {
              await updateUserLoginMeta(existingUser.id, ipAddress, false);

              if (attempts >= BRUTE_FORCE_LOCK_THRESHOLD) {
                await lockUserForBruteForce(existingUser.id, BRUTE_FORCE_LOCK_MINUTES);
                return sendAuthError(
                  res,
                  423,
                  {
                    error: tServer(resolveLocaleFromHeaders(req.headers), "auth.error.accountLockedSecurity"),
                    code: "AUTH_ACCOUNT_LOCKED",
                  }
                );
              }
            }

            return sendAuthError(
              res,
              401,
              {
                ...normalizedAuthError,
                requiresCaptcha: false,
              }
            );
          }

          const payload = await parseJsonSafely(response);
          const resolvedSessionUser = resolveSessionUser(payload);
          let loginUserResponse: AuthUserResponsePayload | null = null;
          let accessToken: string | null = null;

          if (resolvedSessionUser?.id) {
            await clearFailedLoginAttempts(email, ipAddress);
            await clearUserLock(resolvedSessionUser.id);
            await updateUserLoginMeta(resolvedSessionUser.id, ipAddress, true);

            const anomaly = await detectLoginAnomaly(resolvedSessionUser.id, ipAddress, String(userAgent));
            if (anomaly.isAnomalous && anomaly.severity === "critical") {
              return res.status(403).json({
                error: tServer(resolveLocaleFromHeaders(req.headers), "auth.login.suspicious"),
                requiresVerification: true,
                retryAfterSeconds: anomaly.retryAfterSeconds ?? 600,
                verificationHint: tServer(resolveLocaleFromHeaders(req.headers), "auth.login.suspiciousHint"),
              });
            }

          const signedInUserRow = await getUserById(resolvedSessionUser.id);
          if (signedInUserRow) {
            const normalizedUser = signedInUserRow;
            const localeAwareUser = await syncUserLocaleIfNeeded(normalizedUser, requestLocale);
            loginUserResponse = await buildAuthenticatedUserResponse(localeAwareUser);
            accessToken = issueAccessToken({
              sub: localeAwareUser.id,
              email: localeAwareUser.email,
              emailVerified: localeAwareUser.emailVerified,
              sessionId: resolveSessionId(payload) ?? "cookie-session",
            });
          }
          }

          return res.status(200).json({
            success: true,
            message: tServer(resolveLocaleFromHeaders(req.headers), "auth.login.success"),
            user: loginUserResponse,
            accessToken,
          });
        } catch (error) {
          return next(error);
        }
      },
    );

    app.post(
      "/api/auth/verify-email",
      jsonParser,
      urlEncodedParser,
      authenticateBearerToken,
      requireNoActiveBan,
      async (req: Request, res: Response, next: NextFunction) => {
        try {
          const requestLocale = detectRequestLocale(req);
          if (!isEmailDeliveryEnabled()) {
            return sendAuthError(res, 503, {
              error: tServer(resolveLocaleFromHeaders(req.headers), "auth.error.emailDeliveryUnavailable"),
              code: "AUTH_EMAIL_DELIVERY_UNAVAILABLE",
            });
          }

          const userRow = await getUserById(req.authUser!.sub);
          if (!userRow) {
            return res.status(404).json({ error: tServer(resolveLocaleFromHeaders(req.headers), "auth.error.userNotFound") });
          }
          const localeAwareUser = await syncUserLocaleIfNeeded(userRow, requestLocale);

          if (localeAwareUser.emailVerified) {
            return res.status(200).json({
              success: true,
              message: tServer(resolveLocaleFromHeaders(req.headers), "auth.verifyEmail.alreadyConfirmed"),
            });
          }

          const response = await auth.api.sendVerificationEmail({
            headers: buildAuthForwardHeaders(req.headers),
            body: {
              email: localeAwareUser.email,
            },
            asResponse: true,
          });

          if (!response.ok) {
            return sendNormalizedAuthApiError(res, response, {
              fallbackError: tServer(resolveLocaleFromHeaders(req.headers), "auth.verifyEmail.sendFailed"),
              locale: resolveLocaleFromHeaders(req.headers),
            });
          }

          return res.status(200).json({
            success: true,
            message: tServer(resolveLocaleFromHeaders(req.headers), "auth.verifyEmail.sent"),
          });
        } catch (error) {
          return next(error);
        }
      },
    );

    app.post(
      "/api/auth/confirm-email",
      jsonParser,
      urlEncodedParser,
      async (req: Request, res: Response, next: NextFunction) => {
        const body = asObject(req.body);
        if (!body) {
          return sendAuthError(res, 400, { error: tServer(resolveLocaleFromHeaders(req.headers), "auth.error.requestBodyInvalid") });
        }

        const token = typeof body.token === "string" ? body.token.trim() : "";
        if (!token) {
          return sendAuthError(res, 400, {
            error: tServer(resolveLocaleFromHeaders(req.headers), "auth.error.invalidToken"),
            code: "AUTH_INVALID_TOKEN",
          });
        }

        try {
          const response = await auth.api.verifyEmail({
            headers: buildAuthForwardHeaders(req.headers),
            query: {
              token,
            },
            asResponse: true,
          });

          if (!response.ok) {
            return sendNormalizedAuthApiError(res, response, {
              fallbackError: tServer(resolveLocaleFromHeaders(req.headers), "auth.confirmEmail.failed"),
              fallbackCode: "AUTH_INVALID_TOKEN",
              locale: resolveLocaleFromHeaders(req.headers),
            });
          }

          return res.status(200).json({
            success: true,
            message: tServer(resolveLocaleFromHeaders(req.headers), "auth.confirmEmail.success"),
          });
        } catch (error) {
          return next(error);
        }
      },
    );

    app.post(
      "/api/auth/forgot-password",
      jsonParser,
      urlEncodedParser,
      forgotPasswordLimiter,
      forgotPasswordValidation,
      handleValidationErrors,
      async (req: Request, res: Response, next: NextFunction) => {
        const body = asObject(req.body);
        if (!body) {
          return sendAuthError(res, 400, { error: tServer(resolveLocaleFromHeaders(req.headers), "auth.error.requestBodyInvalid") });
        }

        const email = normalizeEmail(String(body.email ?? ""));
        const requestLocale = detectRequestLocale(req, body);

        try {
          if (!isEmailDeliveryEnabled()) {
            return sendAuthError(res, 503, {
              error: tServer(resolveLocaleFromHeaders(req.headers), "auth.error.emailDeliveryUnavailable"),
              code: "AUTH_EMAIL_DELIVERY_UNAVAILABLE",
            });
          }

          const targetUser = await findUserByEmail(email);
          if (targetUser) {
            await syncUserLocaleIfNeeded(targetUser, requestLocale);
          }
          const response = await auth.api.requestPasswordReset({
            headers: buildAuthForwardHeaders(req.headers),
            body: {
              email,
              redirectTo: `${env.appBaseUrl}/#/reset-password`,
            },
            asResponse: true,
          });

          if (!response.ok) {
            return sendNormalizedAuthApiError(res, response, {
              fallbackError: tServer(resolveLocaleFromHeaders(req.headers), "auth.forgotPassword.failed"),
              locale: resolveLocaleFromHeaders(req.headers),
            });
          }

          return res.status(200).json({
            success: true,
            message: tServer(resolveLocaleFromHeaders(req.headers), "auth.forgotPassword.sent"),
          });
        } catch (error) {
          return next(error);
        }
      },
    );

    app.post(
      "/api/auth/reset-password",
      jsonParser,
      urlEncodedParser,
      resetPasswordLimiter,
      resetPasswordValidation,
      handleValidationErrors,
      async (req: Request, res: Response, next: NextFunction) => {
        const body = asObject(req.body);
        if (!body) {
          return sendAuthError(res, 400, { error: tServer(resolveLocaleFromHeaders(req.headers), "auth.error.requestBodyInvalid") });
        }

        const token = typeof body.token === "string" ? body.token.trim() : "";
        const newPassword = typeof body.password === "string" ? body.password : "";

        const passwordValidation = validatePassword(newPassword);
        if (!passwordValidation.isValid) {
          return sendAuthError(res, 400, {
            error: tServer(resolveLocaleFromHeaders(req.headers), "auth.error.passwordInvalid"),
            details: passwordValidation.errors,
          });
        }

        try {
          const response = await auth.api.resetPassword({
            headers: buildAuthForwardHeaders(req.headers),
            body: {
              token,
              newPassword,
            },
            asResponse: true,
          });

          if (!response.ok) {
            return sendNormalizedAuthApiError(res, response, {
              fallbackError: tServer(resolveLocaleFromHeaders(req.headers), "auth.resetPassword.failed"),
              locale: resolveLocaleFromHeaders(req.headers),
            });
          }

          return res.status(200).json({
            success: true,
            message: tServer(resolveLocaleFromHeaders(req.headers), "auth.resetPassword.success"),
          });
        } catch (error) {
          return next(error);
        }
      },
    );

    app.get("/api/auth/session", async (req: Request, res: Response, next: NextFunction) => {
      try {
        const sessionResult = await auth.api.getSession({
          headers: buildAuthForwardHeaders(req.headers, {
            includeCookie: true,
          }),
        });

        const sessionUser = resolveSessionUser(sessionResult);
        if (!sessionUser) {
          return sendAuthError(
            res,
            401,
            {
              error: tServer(resolveLocaleFromHeaders(req.headers), "auth.error.notAuthenticated"),
              code: "AUTH_SESSION_REQUIRED",
            }
          );
        }

        const userRow = await getUserById(sessionUser.id);
        if (!userRow) {
          return sendAuthError(
            res,
            401,
            {
              error: tServer(resolveLocaleFromHeaders(req.headers), "auth.error.userNotFound"),
              code: "AUTH_SESSION_REQUIRED",
            }
          );
        }

        const activeBan = await findActiveBanForSignals(
          buildBanCheckSignalsForRequest(req, {
            userId: sessionUser.id,
            desktopDeviceId: getRequestDesktopDeviceId(req),
          }),
        );
        if (activeBan) {
          return sendActiveBanResponse(res, "/api/auth/session", activeBan);
        }

        const normalizedUser = userRow;
        const localeAwareUser = await syncUserLocaleIfNeeded(
          normalizedUser,
          detectRequestLocale(req),
        );
        if (await enforceMandatoryUpdateIfNeeded(req, res, "/api/auth/session")) {
          return;
        }

        const accessToken = issueAccessToken({
          sub: localeAwareUser.id,
          email: localeAwareUser.email,
          emailVerified: localeAwareUser.emailVerified,
          sessionId: resolveSessionId(sessionResult) ?? "cookie-session",
        });

        return res.status(200).json({
          user: await buildAuthenticatedUserResponse(localeAwareUser),
          accessToken,
        });
      } catch (error) {
        return next(error);
      }
    });

    app.post(
      "/api/auth/dashboard/launch",
      jsonParser,
      urlEncodedParser,
      dashboardLaunchLimiter,
      (req: Request, res: Response) => {
        logger.warn("Blocked web dashboard launch attempt", {
          ipAddress: getClientIp(req),
          userAgent: req.headers["user-agent"] ?? "unknown",
        });
        return res.status(403).json({
          error: tServer(resolveLocaleFromHeaders(req.headers), "auth.error.desktopClientRequired"),
          code: "WEB_DASHBOARD_DISABLED",
        });
      },
    );

    app.post(
      "/api/auth/dashboard/consume-launch",
      jsonParser,
      urlEncodedParser,
      dashboardLaunchLimiter,
      (req: Request, res: Response) => {
        logger.warn("Blocked web dashboard consume attempt", {
          ipAddress: getClientIp(req),
          userAgent: req.headers["user-agent"] ?? "unknown",
        });
        return res.status(403).json({
          error: tServer(resolveLocaleFromHeaders(req.headers), "auth.error.desktopClientRequired"),
          code: "WEB_DASHBOARD_DISABLED",
        });
      },
    );

    app.get("/api/auth/verify", authenticateBearerToken, requireNoActiveBan, async (req: Request, res: Response) => {
      const userRow = await getUserById(req.authUser!.sub);
      if (!userRow) {
        return res.status(401).json({
          error: tServer(resolveLocaleFromHeaders(req.headers), "auth.error.invalidToken"),
          code: "AUTH_INVALID_TOKEN",
        });
      }

      const normalizedUser = userRow;
      if (await enforceMandatoryUpdateIfNeeded(req, res, "/api/auth/verify")) {
        return;
      }
      return res.json(await buildAuthenticatedUserResponse(normalizedUser));
    });

    app.post(
      "/api/auth/locale",
      jsonParser,
      urlEncodedParser,
      authenticateBearerToken,
      async (req: Request, res: Response) => {
        const authUser = req.authUser;
        if (!authUser?.sub) {
          return res.status(401).json({
            error: tServer(resolveLocaleFromHeaders(req.headers), "auth.error.notAuthenticated"),
            code: "AUTH_SESSION_REQUIRED",
          });
        }

        const body = asObject(req.body);
        const locale = detectRequestLocale(req, body);
        if (!locale) {
          return res.status(400).json({
            error: tServer(resolveLocaleFromHeaders(req.headers), "auth.error.localeInvalid"),
            code: "AUTH_INVALID_LOCALE",
          });
        }

        const userRow = await getUserById(authUser.sub);
        if (!userRow) {
          return res.status(404).json({
            error: tServer(resolveLocaleFromHeaders(req.headers), "auth.error.userNotFound"),
            code: "AUTH_INVALID_TOKEN",
          });
        }

        const updated = await syncUserLocaleIfNeeded(userRow, locale);
        return res.status(200).json({
          success: true,
          locale: updated.locale,
        });
      },
    );

}

export function registerAuthFallbackRoutes(app: express.Express): void {
    app.post("/api/auth/sign-in/email", (_req: Request, res: Response) => {
      res.status(404).json({ error: tServer(resolveLocaleFromHeaders(_req.headers), "auth.error.loginRouteHint") });
    });

    app.post("/api/auth/sign-up/email", (_req: Request, res: Response) => {
      res.status(404).json({ error: tServer(resolveLocaleFromHeaders(_req.headers), "auth.error.registerRouteHint") });
    });

    app.all("/api/auth/*", (req: Request, res: Response) => {
      betterAuthHandler(req, res);
    });

    app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      const message =
        tServer(resolveLocaleFromHeaders(_req.headers), "auth.error.serverInternal");

      logger.error("Unhandled auth-server error", {
        message,
        stack: error instanceof Error ? error.stack : undefined,
      });

      res.status(500).json({
        error: tServer(resolveLocaleFromHeaders(_req.headers), "auth.error.serverInternal"),
      });
    });

}
