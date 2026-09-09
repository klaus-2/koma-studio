import type { NextFunction, Request, Response } from "express";
import { body, validationResult } from "express-validator";
import helmet from "helmet";
import { resolveLocaleFromHeaders, tServer } from "../services/server-i18n.js";

export const wafHelmet = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: {
    policy: "strict-origin-when-cross-origin",
  },
});

export const registerValidation = [
  body("email").isEmail().normalizeEmail().withMessage("auth.validation.emailInvalid"),
  body("password").isString().isLength({ min: 12 }).withMessage("auth.validation.passwordWeak"),
  body("name")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage("auth.validation.nameInvalid"),
];

export const loginValidation = [
  body("email").isEmail().normalizeEmail().withMessage("auth.validation.emailInvalid"),
  body("password").isString().isLength({ min: 1 }).withMessage("auth.validation.passwordRequired"),
];

export const forgotPasswordValidation = [
  body("email").isEmail().normalizeEmail().withMessage("auth.validation.emailInvalid"),
];

export const resetPasswordValidation = [
  body("token").isString().isLength({ min: 10 }).withMessage("auth.error.invalidToken"),
  body("password").isString().isLength({ min: 12 }).withMessage("auth.validation.passwordWeak"),
];

export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction,
): void | Response => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const locale = resolveLocaleFromHeaders(req.headers);
    const sensitiveFields = new Set(["password", "captchaToken"]);
    const sanitizedDetails = errors.array().map((error) => {
      if (!("path" in error)) {
        return error;
      }

      const translatedMessage =
        typeof error.msg === "string" && error.msg.includes(".") ? tServer(locale, error.msg) : error.msg;

      if (!sensitiveFields.has(error.path)) {
        return {
          ...error,
          msg: translatedMessage,
        };
      }

      return {
        ...error,
        msg: translatedMessage,
        value: "[REDACTED]",
      };
    });

    return res.status(400).json({
      error: tServer(locale, "auth.validation.invalidData"),
      details: sanitizedDetails,
    });
  }

  next();
};

export const preventPathTraversal = (req: Request, res: Response, next: NextFunction): void | Response => {
  // Validate only the request path. Query strings may legitimately include encoded slashes
  // (e.g. callbackURL=http%3A%2F%2F...) and should not trigger traversal rules.
  const suspiciousPatterns = ["..", "./", "\\", "%2e", "%5c"];
  const pathOnly = req.path.toLowerCase();

  if (suspiciousPatterns.some((pattern) => pathOnly.includes(pattern))) {
    return res.status(400).json({
      error: tServer(resolveLocaleFromHeaders(req.headers), "auth.validation.requestBlocked"),
    });
  }

  next();
};
