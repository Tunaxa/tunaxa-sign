import type { Request, Response, NextFunction } from "express";
import { type ZodSchema, ZodError } from "zod";
import { ValidationError } from "@axa-sign/shared";

export function validate(schema: ZodSchema, source: "body" | "query" | "params" = "body") {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const data = schema.parse(req[source]);
      if (source === "query") {
        Object.defineProperty(req, "query", {
          value: data,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      } else {
        req[source] = data;
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors: Record<string, string[]> = {};
        error.errors.forEach((e) => {
          const path = e.path.join(".");
          if (!errors[path]) errors[path] = [];
          errors[path].push(e.message);
        });
        next(new ValidationError(errors));
      } else {
        next(error);
      }
    }
  };
}
