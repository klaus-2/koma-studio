import { randomUUID } from "node:crypto";

import { hash, verify } from "@node-rs/argon2";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { haveIBeenPwned } from "better-auth/plugins/haveibeenpwned";
import { oneTimeToken } from "better-auth/plugins/one-time-token";

import { env } from "../config/env.js";
import { db } from "../db/client.js";
import * as schema from "../db/schema.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "../services/email.js";
import { normalizeEmailLocale } from "../services/locale.js";
import { tServer } from "../services/server-i18n.js";

const plugins: any[] = [
  haveIBeenPwned({
    customPasswordCompromisedMessage: tServer("en", "auth.error.passwordCompromised"),
  }),
  oneTimeToken({
    expiresIn: 2,
    disableClientRequest: true,
    storeToken: "hashed",
  }),
];

const deriveCrossSubDomainCookieDomain = (): string | null => {
  if (env.crossSubDomainCookieDomain) {
    return env.crossSubDomainCookieDomain;
  }

  try {
    const host = new URL(env.betterAuthUrl).hostname.trim().toLowerCase();
    if (!host || host === "localhost" || host.startsWith("127.") || host.startsWith("[")) {
      return null;
    }

    const labels = host.split(".").filter(Boolean);
    if (labels.length < 2) {
      return null;
    }

    return `.${labels.slice(-2).join(".")}`;
  } catch {
    return null;
  }
};

const crossSubDomainCookieDomain = deriveCrossSubDomainCookieDomain();

export const auth = betterAuth({
  secret: env.betterAuthSecret,
  baseURL: env.betterAuthUrl,
  trustedOrigins: env.allowedOrigins,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    autoSignIn: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    password: {
      hash: async (password: string) =>
        hash(password, {
          memoryCost: 19_456,
          timeCost: 2,
          outputLen: 32,
          parallelism: 1,
        }),
      verify: async ({ hash: encodedHash, password }: { hash: string; password: string }) =>
        verify(encodedHash, password),
    },
    sendResetPassword: async ({ user, url }: any) => {
      const sent = await sendPasswordResetEmail({
        email: user.email,
        resetUrl: url,
        userName: typeof user.name === "string" ? user.name : undefined,
        locale:
          typeof user.locale === "string"
            ? normalizeEmailLocale(user.locale)
            : null,
      });
      if (!sent) {
        throw new Error(tServer("en", "auth.error.emailDeliveryUnavailable"));
      }
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }: any) => {
      const sent = await sendVerificationEmail({
        email: user.email,
        verificationUrl: url,
        userName: typeof user.name === "string" ? user.name : undefined,
        locale:
          typeof user.locale === "string"
            ? normalizeEmailLocale(user.locale)
            : null,
      });
      if (!sent) {
        throw new Error(tServer("en", "auth.error.emailDeliveryUnavailable"));
      }
    },
  },
  user: {
    additionalFields: {
      locale: {
        type: "string",
        required: false,
        defaultValue: "en",
        input: true,
      },
      passwordChangedAt: {
        type: "date",
        required: false,
        input: false,
      },
      failedLoginAttempts: {
        type: "number",
        required: false,
        defaultValue: 0,
        input: false,
      },
      accountLockedUntil: {
        type: "date",
        required: false,
        input: false,
      },
      lastLoginAt: {
        type: "date",
        required: false,
        input: false,
      },
      lastLoginIp: {
        type: "string",
        required: false,
        input: false,
      },
      loginHistory: {
        type: "string",
        required: false,
        input: false,
      },
      appRole: {
        type: "string",
        required: false,
        defaultValue: "user",
        input: false,
      },
    },
  },
  session: {
    expiresIn: 60 * 30,
    updateAge: 60 * 2,
    freshAge: 60,
  },
  advanced: {
    useSecureCookies: env.nodeEnv === "production",
    cookiePrefix: "koma-studio",
    defaultCookieAttributes: {
      secure: env.nodeEnv === "production",
      sameSite: "strict",
      httpOnly: true,
    },
    ipAddress: {
      ipAddressHeaders: ["cf-connecting-ip", "x-real-ip", "x-forwarded-for"],
    },
    ...(crossSubDomainCookieDomain
      ? {
          crossSubDomainCookies: {
            enabled: true,
            domain: crossSubDomainCookieDomain,
          },
        }
      : {}),
    generateId: () => randomUUID(),
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: env.nodeEnv === "production" ? 20 : 100,
  },
  plugins,
  // Better Auth's built-in telemetry — explicitly disabled.
  telemetry: { enabled: false },
});
