import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Algorithm, Secret } from "jsonwebtoken";

import { env } from "../config/env.js";
import { db } from "../db/client.js";
import { user } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { resolveLocaleFromHeaders, tServer } from "../services/server-i18n.js";
import { isTokenRevoked, isUserTokenRevoked } from "../services/token-blocklist.js";

export interface AuthTokenPayload {
  sub: string;
  email: string;
  emailVerified: boolean;
  sessionId: string;
}

const TOKEN_TTL_SECONDS = 60 * 10;
const TOKEN_ISSUER = "koma-studio-auth-server";
const TOKEN_AUDIENCE = "koma-studio-backend";

const resolveJwtSigningKey = (): Secret => {
  if (env.jwtAlgorithm === "RS256") {
    if (!env.jwtPrivateKey) {
      throw new Error(tServer("en", "auth.config.jwtPrivateKeyMissing"));
    }
    return env.jwtPrivateKey;
  }

  return env.jwtSecret;
};

const resolveJwtVerificationKeys = (): Secret[] => {
  if (env.jwtAlgorithm === "RS256") {
    if (!env.jwtPublicKey) {
      throw new Error(tServer("en", "auth.config.jwtPublicKeyMissing"));
    }

    return [env.jwtPublicKey, ...env.jwtPreviousPublicKeys];
  }

  return [env.jwtSecret, ...env.jwtPreviousSecrets];
};

export const issueAccessToken = (payload: AuthTokenPayload): string =>
  jwt.sign(payload, resolveJwtSigningKey(), {
    algorithm: env.jwtAlgorithm as Algorithm,
    expiresIn: TOKEN_TTL_SECONDS,
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
    keyid: env.jwtKeyId,
  });

export const verifyAccessToken = (token: string): AuthTokenPayload => {
  const verificationKeys = resolveJwtVerificationKeys();
  let lastError: unknown = null;

  for (const key of verificationKeys) {
    try {
      return jwt.verify(token, key, {
        algorithms: [env.jwtAlgorithm as Algorithm],
        issuer: TOKEN_ISSUER,
        audience: TOKEN_AUDIENCE,
      }) as AuthTokenPayload;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error(tServer("en", "auth.error.invalidToken"));
};

export const authenticateBearerToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void | Response> => {
  const locale = resolveLocaleFromHeaders(req.headers);
  const raw = req.headers.authorization;
  if (!raw?.startsWith("Bearer ")) {
    return res.status(401).json({
      error: tServer(locale, "auth.error.tokenMissing"),
      code: "AUTH_SESSION_REQUIRED",
    });
  }

  const token = raw.replace("Bearer ", "").trim();
  if (!token) {
    return res.status(401).json({
      error: tServer(locale, "auth.error.tokenMissing"),
      code: "AUTH_SESSION_REQUIRED",
    });
  }

  try {
    req.authUser = verifyAccessToken(token);
  } catch {
    return res.status(401).json({
      error: tServer(locale, "auth.error.invalidToken"),
      code: "AUTH_INVALID_TOKEN",
    });
  }

  // Check session-level revocation (logout)
  const sessionRevoked = await isTokenRevoked(req.authUser.sessionId);
  if (sessionRevoked) {
    return res.status(401).json({
      error: tServer(locale, "auth.error.sessionRevoked"),
      code: "AUTH_SESSION_REVOKED",
    });
  }

  // Check user-level revocation (ban, manual revoke)
  const userRevoked = await isUserTokenRevoked(req.authUser.sub);
  if (userRevoked) {
    return res.status(401).json({
      error: tServer(locale, "auth.error.sessionRevoked"),
      code: "AUTH_SESSION_REVOKED",
    });
  }

  // Check password change — if password was changed after token was issued, reject
  const decoded = jwt.decode(token, { complete: true });
  const tokenIssuedAt = (decoded?.payload as { iat?: number } | null)?.iat;
  if (tokenIssuedAt) {
    try {
      const [row] = await db
        .select({ passwordChangedAt: user.passwordChangedAt })
        .from(user)
        .where(eq(user.id, req.authUser.sub))
        .limit(1);
      if (row?.passwordChangedAt) {
        const pwdChangedMs = row.passwordChangedAt.getTime();
        if (tokenIssuedAt * 1000 < pwdChangedMs) {
          return res.status(401).json({
            error: tServer(locale, "auth.error.sessionRevoked"),
            code: "AUTH_SESSION_REVOKED",
          });
        }
      }
    } catch {
      // DB unavailable — allow token through (password change is rare;
      // fail-open is acceptable here since JWT TTL is only 10 minutes)
    }
  }

  next();
};
