import type { Request, Response, NextFunction } from "express";
import { generateId } from "@axa-sign/shared";

export function requestId(req: Request, _res: Response, next: NextFunction) {
  const id = (req.headers["x-request-id"] as string) || generateId("req");
  req.headers["x-request-id"] = id;
  next();
}
