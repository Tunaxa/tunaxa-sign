import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "./jwt";
import type { JwtPayload } from "./types";
import { UnauthorizedError } from "@axa-sign/shared";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedError("Missing or invalid authorization header");
    }

    const token = authHeader.split(" ")[1];
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    next(new UnauthorizedError("Invalid or expired token"));
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }
    if (!roles.includes(req.user.role)) {
      return next(new UnauthorizedError("Insufficient permissions"));
    }
    next();
  };
}

export function requireOwnership(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return next(new UnauthorizedError());
  }
  // Ownership is verified at the service level using organizationId
  next();
}
