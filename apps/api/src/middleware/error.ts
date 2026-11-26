import type { Request, Response, NextFunction } from "express";
import multer from "multer";
import { AppError, ValidationError } from "@axa-sign/shared";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error("[Error]", err);

  if (err instanceof ValidationError) {
    return res.status(400).json({
      error: err.message,
      code: err.code,
      details: err.errors,
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
  }

  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      error: "File exceeds maximum allowed size",
      code: "PAYLOAD_TOO_LARGE",
    });
  }

  return res.status(500).json({
    error: "Internal server error",
    code: "INTERNAL_ERROR",
  });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: `Route ${req.method} ${req.path} not found`,
    code: "NOT_FOUND",
  });
}
