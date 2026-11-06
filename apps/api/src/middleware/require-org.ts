import type { Request, Response, NextFunction } from "express";
import { UnauthorizedError } from "@axa-sign/shared";

export function requireOrganization(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  if (!req.user?.organizationId) {
    return next(new UnauthorizedError("No organization context"));
  }
  next();
}
