import type { NextFunction, Request, Response } from "express";
import rateLimit, { type Options } from "express-rate-limit";
import {
  hashToken,
  LOGIN_RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  RateLimitError,
  SIGNING_IP_RATE_LIMIT_MAX,
  SIGNING_TOKEN_RATE_LIMIT_MAX,
} from "@axa-sign/shared";

export function rateLimitHandler(
  _req: Request,
  _res: Response,
  next: NextFunction
): void {
  next(new RateLimitError());
}

function createLimiter(overrides: Partial<Options>) {
  return rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
    ...overrides,
  });
}

export const signingIpLimiter = createLimiter({
  max: SIGNING_IP_RATE_LIMIT_MAX,
});

export const signingTokenLimiter = createLimiter({
  max: SIGNING_TOKEN_RATE_LIMIT_MAX,
  keyGenerator: (req) => {
    const token = req.params.token;
    if (typeof token === "string" && token.length > 0) {
      return hashToken(token);
    }
    return req.ip || "unknown";
  },
});

export const loginLimiter = createLimiter({
  max: LOGIN_RATE_LIMIT_MAX,
  skipSuccessfulRequests: true,
});
