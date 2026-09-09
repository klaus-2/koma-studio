import type { AuthTokenPayload } from "../auth/middleware.js";

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthTokenPayload;
    }
  }
}

export {};
