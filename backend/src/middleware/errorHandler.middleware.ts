import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/apiError";
import { env } from "../config/env";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: env.NODE_ENV === "development" ? err.details : undefined,
      },
    });
    return;
  }

  console.error("[Unhandled Error]:", err);

  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message:
        env.NODE_ENV === "development"
          ? err.message
          : "An internal server error occurred.",
      details: env.NODE_ENV === "development" ? err.stack : undefined,
    },
  });
}
