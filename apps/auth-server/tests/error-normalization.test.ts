import assert from "node:assert/strict";
import test from "node:test";

import { normalizeAuthErrorPayload } from "../src/auth/error-normalization.ts";

test("normalizeAuthErrorPayload maps existing user errors to project codes", () => {
  const normalized = normalizeAuthErrorPayload(
    {
      code: "USER_ALREADY_EXISTS",
      message: "User already exists.",
    },
    {
      fallbackError: "Falha ao registrar usuario.",
      locale: "pt-br",
    },
  );

  assert.deepEqual(normalized, {
    error: "Ja existe uma conta com este email.",
    code: "AUTH_USER_ALREADY_EXISTS",
  });
});

test("normalizeAuthErrorPayload maps compromised password errors to project codes", () => {
  const normalized = normalizeAuthErrorPayload(
    {
      code: "PASSWORD_COMPROMISED",
      message: "The password you entered has been compromised.",
    },
    {
      fallbackError: "Falha ao registrar usuario.",
      locale: "pt-br",
    },
  );

  assert.deepEqual(normalized, {
    error: "Esta senha apareceu em vazamentos conhecidos. Escolha outra senha.",
    code: "AUTH_PASSWORD_COMPROMISED",
  });
});

test("normalizeAuthErrorPayload maps invalid token errors to project codes", () => {
  const normalized = normalizeAuthErrorPayload(
    {
      code: "INVALID_TOKEN",
      message: "Invalid token",
    },
    {
      fallbackError: "Falha ao confirmar email.",
      locale: "pt-br",
    },
  );

  assert.deepEqual(normalized, {
    error: "Token inválido ou expirado.",
    code: "AUTH_INVALID_TOKEN",
  });
});

test("normalizeAuthErrorPayload falls back to local defaults for unknown payloads", () => {
  const normalized = normalizeAuthErrorPayload(null, {
    fallbackError: "Credenciais invalidas.",
    fallbackCode: "AUTH_INVALID_CREDENTIALS",
    locale: "pt-br",
  });

  assert.deepEqual(normalized, {
    error: "Credenciais invalidas.",
    code: "AUTH_INVALID_CREDENTIALS",
  });
});
