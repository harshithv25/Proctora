import { Request, Response, NextFunction } from "express";
import { z, ZodSchema } from "zod";
import { BadRequestError } from "../lib/apiError";

interface ValidationTarget {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}

export function validate(schemas: ValidationTarget) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const errors: Record<string, unknown> = {};

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        errors.body = (result as any).error.format();
      } else {
        req.body = result.data;
      }
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        errors.params = (result as any).error.format();
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        errors.query = (result as any).error.format();
      }
    }

    if (Object.keys(errors).length > 0) {
      throw new BadRequestError("Validation failed", "VALIDATION_ERROR", errors);
    }

    next();
  };
}
