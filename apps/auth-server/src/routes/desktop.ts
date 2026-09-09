import { createHmac, randomBytes, randomUUID } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import { eq } from "drizzle-orm";

import { auth } from "../auth/config.js";
import { buildAuthForwardHeaders } from "../auth/forward-headers.js";
import { env, isWebRequest } from "../config/env.js";
import { db } from "../db/client.js";
import { desktopAuthDevice, desktopTravelToken } from "../db/schema.js";
import { recordSecurityLog } from "../security/anomaly.js";
import { getClientIp } from "../security/client-ip.js";
import { desktopBootstrapLimiter } from "../security/rate-limiter.js";
import {
  buildBanCheckSignalsForRequest,
  findActiveBanForSignals,
} from "../services/ban-enforcement.js";
import { isEmailDeliveryEnabled, sendDesktopTravelTokenEmail } from "../services/email.js";
import { normalizeEmailLocale } from "../services/locale.js";
import { resolveLocaleFromHeaders, tServer } from "../services/server-i18n.js";

import {
  DESKTOP_BOOTSTRAP_SECRET_HEADER,
  DESKTOP_CLIENT_TOKEN_HEADER,
  DESKTOP_DEVICE_ID_HEADER,
  DESKTOP_DEVICE_KEY_HEADER,
  DESKTOP_PRIMARY_SLOT,
  DESKTOP_SESSION_ID_HEADER,
  DESKTOP_TRAVEL_SLOT,
  DESKTOP_TRAVEL_TOKEN_HEADER,
  asObject,
  clampDesktopTokenTtlSec,
  clampDesktopTravelDurationDays,
  clampDesktopTravelTokenTtlMinutes,
  cleanupDesktopClientSessionsIfNeeded,
  consumeDesktopTravelToken,
  desktopClientSessions,
  detectRequestLocale,
  findDesktopDeviceByCredential,
  getDesktopDeviceByUserAndSlot,
  getUserById,
  isAdminWebRequest,
  isDesktopTravelDeviceActive,
  isSafeDesktopIdentifier,
  jsonParser,
  maskEmailAddress,
  normalizeDesktopSlot,
  normalizeDesktopTravelTokenDeliveryMode,
  purgeDesktopClientSessionsForUser,
  readHeaderValue,
  resolveSessionUser,
  safeTokenEquals,
  sendActiveBanResponse,
  sendAuthError,
  sha256Hex,
  shouldBypassDesktopClientEnforcement,
  syncUserLocaleIfNeeded,
  upsertDesktopDevice,
} from "./_shared.js";

const computeDesktopHwidHmac = (deviceId: string): string =>
  createHmac("sha256", env.betterAuthSecret)
    .update(`desktop-hwid-v1:${deviceId}`)
    .digest("hex");

export function registerDesktopRoutes(app: express.Express): void {
    app.post(
      "/api/internal/desktop-client/register",
      jsonParser,
      desktopBootstrapLimiter,
      async (req: Request, res: Response) => {
        const body = asObject(req.body) ?? {};

        const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
        if (!isSafeDesktopIdentifier(deviceId)) {
          return res.status(400).json({
            error: tServer(resolveLocaleFromHeaders(req.headers), "auth.desktop.register.invalidDeviceId"),
            code: "DESKTOP_REGISTER_INVALID_PAYLOAD",
          });
        }

        const syncReason =
          typeof body.syncReason === "string" && body.syncReason.trim().length > 0
            ? body.syncReason.trim().slice(0, 64)
            : "startup";

        try {
          const sessionResult = await auth.api.getSession({
            headers: buildAuthForwardHeaders(req.headers, {
              includeCookie: true,
            }),
          });
          const sessionUser = resolveSessionUser(sessionResult);
          if (!sessionUser) {
            return sendAuthError(res, 401, {
              error: tServer(resolveLocaleFromHeaders(req.headers), "auth.desktop.sessionInvalidForRegister"),
              code: "AUTH_SESSION_REQUIRED",
            });
          }
          const activeBan = await findActiveBanForSignals(
            buildBanCheckSignalsForRequest(req, {
              userId: sessionUser.id,
              desktopDeviceId: deviceId,
            }),
          );
          if (activeBan) {
            return sendActiveBanResponse(res, "/api/internal/desktop-client/register", activeBan);
          }

          const userAgent =
            typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : "unknown";
          const ipAddress = getClientIp(req);
          const nowMs = Date.now();
          const deviceHmac = computeDesktopHwidHmac(deviceId);
          const providedTravelToken =
            readHeaderValue(req.headers[DESKTOP_TRAVEL_TOKEN_HEADER]) ??
            (typeof body.travelToken === "string" ? body.travelToken.trim() : "");

          const primaryDevice = await getDesktopDeviceByUserAndSlot(
            sessionUser.id,
            DESKTOP_PRIMARY_SLOT,
          );
          const travelDevice = await getDesktopDeviceByUserAndSlot(sessionUser.id, DESKTOP_TRAVEL_SLOT);
          const activeTravelDevice = isDesktopTravelDeviceActive(travelDevice, nowMs) ? travelDevice : null;

          let targetSlot: "primary" | "travel" = DESKTOP_PRIMARY_SLOT;
          let travelExpiresAt: Date | null = null;

          if (!primaryDevice) {
            targetSlot = DESKTOP_PRIMARY_SLOT;
          } else if (safeTokenEquals(primaryDevice.hwidHmac, deviceHmac)) {
            targetSlot = DESKTOP_PRIMARY_SLOT;
          } else if (activeTravelDevice && safeTokenEquals(activeTravelDevice.hwidHmac, deviceHmac)) {
            targetSlot = DESKTOP_TRAVEL_SLOT;
            travelExpiresAt = activeTravelDevice.expiresAt;
          } else if (env.disableTravelTokenEnforcement) {
            // Travel-token enforcement disabled (e.g. desktop clients that no
            // longer issue travel tokens): register the new device on the
            // primary slot without requiring a travel token.
            targetSlot = DESKTOP_PRIMARY_SLOT;
          } else {
            if (!providedTravelToken) {
              return res.status(403).json({
                error:
                  tServer(resolveLocaleFromHeaders(req.headers), "auth.error.desktopTravelTokenRequired"),
                code: "DESKTOP_TRAVEL_TOKEN_REQUIRED",
              });
            }

            const consumedTravelToken = await consumeDesktopTravelToken({
              userId: sessionUser.id,
              token: providedTravelToken,
              consumedByHwidHmac: deviceHmac,
            });
            if (!consumedTravelToken) {
              await recordSecurityLog(
                sessionUser.id,
                "desktop_travel_token_rejected",
                "warning",
                ipAddress,
                userAgent,
                {
                  reason: "invalid_or_expired",
                  deviceId,
                  slot: DESKTOP_TRAVEL_SLOT,
                },
              );
              return res.status(403).json({
                error:
                  tServer(resolveLocaleFromHeaders(req.headers), "auth.error.desktopTravelTokenInvalid"),
                code: "DESKTOP_TRAVEL_TOKEN_INVALID",
              });
            }

            await recordSecurityLog(
              sessionUser.id,
              "desktop_travel_token_consumed",
              "info",
              ipAddress,
              userAgent,
              {
                deviceId,
                slot: DESKTOP_TRAVEL_SLOT,
                tokenId: consumedTravelToken.id,
                travelDays: consumedTravelToken.travelDays,
                expiresAt: consumedTravelToken.expiresAt.toISOString(),
              },
            );

            const travelDays = clampDesktopTravelDurationDays(
              consumedTravelToken.travelDays,
              env.desktopTravelDeviceDurationDays,
            );
            targetSlot = DESKTOP_TRAVEL_SLOT;
            travelExpiresAt = new Date(nowMs + travelDays * 86_400_000);
          }

          const deviceKey = randomBytes(32).toString("base64url");
          const savedDevice = await upsertDesktopDevice({
            userId: sessionUser.id,
            slot: targetSlot,
            deviceHmac,
            deviceKeyHash: sha256Hex(deviceKey),
            expiresAt: travelExpiresAt,
            ipAddress,
            userAgent,
          });

          await recordSecurityLog(
            sessionUser.id,
            "desktop_device_registered",
            "info",
            ipAddress,
            userAgent,
            {
              deviceId,
              slot: savedDevice.slot,
              syncReason,
            },
          );

          return res.status(200).json({
            success: true,
            deviceId,
            deviceKey,
            slot: savedDevice.slot,
            travelExpiresAt:
              normalizeDesktopSlot(savedDevice.slot) === DESKTOP_TRAVEL_SLOT && savedDevice.expiresAt
                ? savedDevice.expiresAt.toISOString()
                : null,
          });
        } catch (error) {
          return sendAuthError(res, 503, {
            error: tServer(resolveLocaleFromHeaders(req.headers), "auth.desktop.register.failed"),
            code: "DESKTOP_REGISTER_FAILED",
          });
        }
      },
    );

    app.post(
      "/api/internal/desktop-client/bootstrap",
      jsonParser,
      desktopBootstrapLimiter,
      async (req: Request, res: Response) => {
        const body = asObject(req.body) ?? {};

        const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
        const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
        const token = typeof body.token === "string" ? body.token.trim() : "";
        if (
          !isSafeDesktopIdentifier(sessionId) ||
          !isSafeDesktopIdentifier(deviceId) ||
          token.length < 43
        ) {
          return sendAuthError(res, 400, {
            error: tServer(resolveLocaleFromHeaders(req.headers), "auth.error.requestBodyInvalid"),
            code: "DESKTOP_BOOTSTRAP_INVALID_PAYLOAD",
          });
        }

        const providedDeviceKey =
          readHeaderValue(req.headers[DESKTOP_DEVICE_KEY_HEADER]) ??
          (typeof body.deviceKey === "string" ? body.deviceKey.trim() : "");
        let validatedDevice: Awaited<ReturnType<typeof findDesktopDeviceByCredential>> = null;
        if (env.enforceDesktopClient) {
          if (!providedDeviceKey) {
            return sendAuthError(res, 401, {
              error: tServer(resolveLocaleFromHeaders(req.headers), "auth.desktop.deviceNotRegistered"),
              code: "DESKTOP_DEVICE_NOT_REGISTERED",
            });
          }

          const deviceHmac = computeDesktopHwidHmac(deviceId);
          validatedDevice = await findDesktopDeviceByCredential({
            deviceHmac,
            deviceKeyHash: sha256Hex(providedDeviceKey),
            nowMs: Date.now(),
          });
          if (!validatedDevice) {
            return sendAuthError(res, 401, {
              error: tServer(resolveLocaleFromHeaders(req.headers), "auth.desktop.deviceKeyInvalid"),
              code: "DESKTOP_DEVICE_KEY_INVALID",
            });
          }
        } else {
          const configuredBootstrapSecret = env.desktopBootstrapSecret?.trim();
          if (configuredBootstrapSecret) {
            const providedSecret = readHeaderValue(req.headers[DESKTOP_BOOTSTRAP_SECRET_HEADER]);
            if (
              !providedSecret ||
              !safeTokenEquals(sha256Hex(providedSecret), sha256Hex(configuredBootstrapSecret))
            ) {
              return sendAuthError(res, 401, {
                error: tServer(resolveLocaleFromHeaders(req.headers), "auth.desktop.bootstrapDenied"),
                code: "DESKTOP_BOOTSTRAP_UNAUTHORIZED",
              });
            }
          }
        }

        const ttlSeconds = clampDesktopTokenTtlSec(body.ttlSeconds, env.desktopClientTokenTtlSec);
        const nowMs = Date.now();
        const expiresAtMs = nowMs + ttlSeconds * 1_000;
        const activeBan = await findActiveBanForSignals(
          buildBanCheckSignalsForRequest(req, {
            userId: validatedDevice?.userId ?? null,
            desktopDeviceId: deviceId,
          }),
        );
        if (activeBan) {
          return sendActiveBanResponse(res, "/api/internal/desktop-client/bootstrap", activeBan);
        }

        cleanupDesktopClientSessionsIfNeeded(nowMs);
        const existingSession = desktopClientSessions.get(sessionId);
        desktopClientSessions.set(sessionId, {
          sessionId,
          deviceId,
          userId: validatedDevice?.userId ?? existingSession?.userId ?? null,
          tokenHash: sha256Hex(token),
          previousTokenHash: existingSession?.tokenHash ?? null,
          previousTokenValidUntilMs:
            nowMs + Math.max(15_000, env.desktopClientTokenRefreshSkewSec * 1_000),
          expiresAtMs,
          createdAtMs: existingSession?.createdAtMs ?? nowMs,
          updatedAtMs: nowMs,
        });
        if (validatedDevice) {
          const userAgent =
            typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : "unknown";
          await db
            .update(desktopAuthDevice)
            .set({
              lastSeenAt: new Date(nowMs),
              lastSeenIp: getClientIp(req),
              lastSeenUserAgent: userAgent,
              updatedAt: new Date(nowMs),
            })
            .where(eq(desktopAuthDevice.id, validatedDevice.id));
        }

        return res.status(200).json({
          success: true,
          sessionId,
          deviceId,
          ttlSeconds,
          refreshAfterSeconds: Math.max(30, ttlSeconds - env.desktopClientTokenRefreshSkewSec),
          expiresAt: new Date(expiresAtMs).toISOString(),
        });
      },
    );

    app.use(async (req: Request, res: Response, next: NextFunction) => {
      if (!env.enforceDesktopClient) {
        next();
        return;
      }

      if (isAdminWebRequest(req)) {
        next();
        return;
      }

      if (shouldBypassDesktopClientEnforcement(req.path)) {
        next();
        return;
      }

      // Dev-only web (Vite/Playwright) bypass: exempt loopback web origins from
      // the desktop-client token requirement so the browser app can authenticate
      // without the desktop client. The desktop app stays enforced.
      if (env.devWebLoginAllowed && isWebRequest(req)) {
        next();
        return;
      }

      const sessionId = readHeaderValue(req.headers[DESKTOP_SESSION_ID_HEADER]);
      const deviceId = readHeaderValue(req.headers[DESKTOP_DEVICE_ID_HEADER]);
      const token = readHeaderValue(req.headers[DESKTOP_CLIENT_TOKEN_HEADER]);
      if (!sessionId || !deviceId || !token) {
        sendAuthError(res, 403, {
          error: tServer(resolveLocaleFromHeaders(req.headers), "auth.desktop.clientRequired"),
          code: "DESKTOP_CLIENT_REQUIRED",
        });
        return;
      }

      cleanupDesktopClientSessionsIfNeeded();
      const record = desktopClientSessions.get(sessionId);
      const nowMs = Date.now();
      if (!record || record.deviceId !== deviceId || record.expiresAtMs <= nowMs) {
        if (record && record.expiresAtMs <= nowMs) {
          desktopClientSessions.delete(sessionId);
        }
        sendAuthError(res, 403, {
          error: tServer(resolveLocaleFromHeaders(req.headers), "auth.desktop.clientSessionInvalid"),
          code: "DESKTOP_CLIENT_SESSION_INVALID",
        });
        return;
      }

      const providedTokenHash = sha256Hex(token);
      const currentTokenMatches = safeTokenEquals(record.tokenHash, providedTokenHash);
      const previousTokenMatches =
        typeof record.previousTokenHash === "string" &&
        record.previousTokenValidUntilMs > nowMs &&
        safeTokenEquals(record.previousTokenHash, providedTokenHash);
      if (!currentTokenMatches && !previousTokenMatches) {
        sendAuthError(res, 403, {
          error: tServer(resolveLocaleFromHeaders(req.headers), "auth.desktop.clientSessionInvalid"),
          code: "DESKTOP_CLIENT_SESSION_INVALID",
        });
        return;
      }

      if (record.previousTokenValidUntilMs <= nowMs) {
        record.previousTokenHash = null;
        record.previousTokenValidUntilMs = 0;
      }
      record.updatedAtMs = nowMs;
      const activeBan = await findActiveBanForSignals(
        buildBanCheckSignalsForRequest(req, {
          userId: record.userId,
          desktopDeviceId: deviceId,
        }),
      );
      if (activeBan) {
        if (record.userId) {
          purgeDesktopClientSessionsForUser(record.userId);
        } else {
          desktopClientSessions.delete(sessionId);
        }
        sendActiveBanResponse(res, req.path, activeBan);
        return;
      }

      next();
    });

    app.post(
      "/api/internal/desktop-client/travel-token",
      jsonParser,
      desktopBootstrapLimiter,
      async (req: Request, res: Response) => {
        const body = asObject(req.body) ?? {};
        const ttlMinutes = clampDesktopTravelTokenTtlMinutes(
          body.ttlMinutes,
          env.desktopTravelTokenTtlMinutes,
        );
        const travelDays = clampDesktopTravelDurationDays(
          body.travelDays,
          env.desktopTravelDeviceDurationDays,
        );
        const deliveryMode = normalizeDesktopTravelTokenDeliveryMode(body.deliveryMode);
        const requestLocale = detectRequestLocale(req, body);

        const deviceId = readHeaderValue(req.headers[DESKTOP_DEVICE_ID_HEADER]);
        if (!deviceId || !isSafeDesktopIdentifier(deviceId)) {
          return res.status(400).json({
            error: tServer(resolveLocaleFromHeaders(req.headers), "auth.desktop.register.invalidDeviceId"),
            code: "DESKTOP_TRAVEL_TOKEN_INVALID_DEVICE",
          });
        }

        try {
          const sessionResult = await auth.api.getSession({
            headers: buildAuthForwardHeaders(req.headers, {
              includeCookie: true,
            }),
          });
          const sessionUser = resolveSessionUser(sessionResult);
          if (!sessionUser) {
            return sendAuthError(res, 401, {
              error: tServer(resolveLocaleFromHeaders(req.headers), "auth.error.sessionRequired"),
              code: "AUTH_SESSION_REQUIRED",
            });
          }
          const activeBan = await findActiveBanForSignals(
            buildBanCheckSignalsForRequest(req, {
              userId: sessionUser.id,
              desktopDeviceId: deviceId,
            }),
          );
          if (activeBan) {
            return sendActiveBanResponse(res, "/api/internal/desktop-client/travel-token", activeBan);
          }

          const primaryDevice = await getDesktopDeviceByUserAndSlot(
            sessionUser.id,
            DESKTOP_PRIMARY_SLOT,
          );
          if (!primaryDevice) {
            return res.status(403).json({
              error: tServer(resolveLocaleFromHeaders(req.headers), "auth.desktop.travelToken.primaryRequired"),
              code: "DESKTOP_PRIMARY_DEVICE_REQUIRED",
            });
          }

          const currentDeviceHmac = computeDesktopHwidHmac(deviceId);
          if (!safeTokenEquals(primaryDevice.hwidHmac, currentDeviceHmac)) {
            return res.status(403).json({
              error: tServer(resolveLocaleFromHeaders(req.headers), "auth.desktop.travelToken.primaryOnly"),
              code: "DESKTOP_TRAVEL_TOKEN_PRIMARY_ONLY",
            });
          }

          if (deliveryMode === "email" && !isEmailDeliveryEnabled()) {
            return sendAuthError(res, 503, {
              error: tServer(resolveLocaleFromHeaders(req.headers), "auth.error.emailDeliveryUnavailable"),
              code: "AUTH_EMAIL_DELIVERY_UNAVAILABLE",
            });
          }

          const rawToken = randomBytes(24).toString("base64url");
          const now = new Date();
          const expiresAt = new Date(now.getTime() + ttlMinutes * 60_000);
          const tokenId = randomUUID();
          const userAgent =
            typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : "unknown";
          const ipAddress = getClientIp(req);
          const destinationMasked = maskEmailAddress(sessionUser.email);

          await db.insert(desktopTravelToken).values({
            id: tokenId,
            userId: sessionUser.id,
            tokenHash: sha256Hex(rawToken),
            travelDays,
            expiresAt,
            issuedBySlot: DESKTOP_PRIMARY_SLOT,
            createdAt: now,
            updatedAt: now,
          });

          if (deliveryMode === "email") {
            const persistedUser = await getUserById(sessionUser.id);
            const localeAwareUser = persistedUser
              ? await syncUserLocaleIfNeeded(persistedUser, requestLocale)
              : null;
            const sent = await sendDesktopTravelTokenEmail({
              email: sessionUser.email,
              token: rawToken,
              expiresAt,
              travelDays,
              userName: sessionUser.name,
              locale: normalizeEmailLocale(localeAwareUser?.locale ?? requestLocale),
            });
            if (!sent) {
              await db.delete(desktopTravelToken).where(eq(desktopTravelToken.id, tokenId));
              return sendAuthError(res, 503, {
                error: tServer(resolveLocaleFromHeaders(req.headers), "auth.error.emailDeliveryUnavailable"),
                code: "AUTH_EMAIL_DELIVERY_UNAVAILABLE",
              });
            }
          }

          await recordSecurityLog(
            sessionUser.id,
            "desktop_travel_token_issued",
            "info",
            ipAddress,
            userAgent,
            {
              tokenId,
              deliveryMode,
              travelDays,
              expiresAt: expiresAt.toISOString(),
              destinationMasked,
            },
          );

          if (deliveryMode === "email") {
            return res.status(201).json({
              success: true,
              deliveryMode,
              emailSent: true,
              destinationMasked,
              expiresAt: expiresAt.toISOString(),
              travelDays,
            });
          }

          return res.status(201).json({
            success: true,
            deliveryMode,
            travelToken: rawToken,
            expiresAt: expiresAt.toISOString(),
            travelDays,
          });
        } catch (error) {
          return sendAuthError(res, 503, {
            error: tServer(resolveLocaleFromHeaders(req.headers), "auth.desktop.travelToken.failed"),
            code: "DESKTOP_TRAVEL_TOKEN_FAILED",
          });
        }
      },
    );

}
