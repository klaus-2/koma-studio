import path from "path";

import winston from "winston";

const logDir = path.resolve(process.cwd(), "logs");
const REDACTED_VALUE = "[REDACTED]";
const SENSITIVE_KEY_REGEX =
  /(authorization|cookie|set-cookie|token|secret|password|api[-_]?key|session[-_]?id)/i;
const SENSITIVE_BEARER_REGEX = /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi;

const redactObject = (input: unknown, seen: WeakSet<object> = new WeakSet()): unknown => {
  if (input === null || typeof input === "undefined") {
    return input;
  }

  if (typeof input === "string") {
    return input.replace(SENSITIVE_BEARER_REGEX, "Bearer [REDACTED]");
  }

  if (typeof input !== "object") {
    return input;
  }

  if (seen.has(input as object)) {
    return "[Circular]";
  }
  seen.add(input as object);

  if (Array.isArray(input)) {
    return input.map((entry) => redactObject(entry, seen));
  }

  const source = input as Record<string, unknown>;
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (SENSITIVE_KEY_REGEX.test(key)) {
      redacted[key] = REDACTED_VALUE;
      continue;
    }
    redacted[key] = redactObject(value, seen);
  }

  return redacted;
};

const redactSensitiveFields = winston.format((info) => {
  const sanitized = redactObject(info) as Record<string, unknown>;
  return {
    ...info,
    ...sanitized,
  };
});

export const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    redactSensitiveFields(),
    winston.format.json(),
  ),
  defaultMeta: {
    service: "koma-studio-auth-server",
  },
  transports: [
    new winston.transports.File({ filename: path.join(logDir, "error.log"), level: "error" }),
    new winston.transports.File({ filename: path.join(logDir, "combined.log") }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  );
}
