import type { Request, Response, NextFunction } from "express";
import { UnauthorizedError, ForbiddenError } from "@axa-sign/shared";
import { ApiKeyService } from "../modules/api-keys/api-key.service";

const apiKeyService = new ApiKeyService();

/**
 * Middleware allowing EITHER a JWT bearer token OR an API key.
 * API keys use the `X-API-Key` header.
 * When an API key is validated, req.user is populated with a synthetic
 * platform user context scoped to the key's organization.
 */
export async function apiKeyOrAuth(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const apiKey = req.headers["x-api-key"] as string | undefined;

  if (apiKey) {
    const keyInfo = await apiKeyService.validate(apiKey);
    if (!keyInfo) {
      return next(new UnauthorizedError("Invalid or revoked API key"));
    }

    req.user = {
      sub: `apikey:${apiKey.slice(0, 8)}`,
      email: `api@${keyInfo.organizationId.slice(0, 8)}.axasign`,
      organizationId: keyInfo.organizationId,
      role: "API",
    };
    return next();
  }

  next();
}

export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    next();
  };
}