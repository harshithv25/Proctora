import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
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

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P1000") {
      res.status(503).json({
        error: {
          code: "DB_AUTH_FAILED",
          message:
            "Database authentication failed. Please check DATABASE_URL credentials in backend/.env.",
          details: env.NODE_ENV === "development" ? err.message : undefined,
        },
      });
      return;
    }
    if (err.code === "P2002") {
      const target = (err.meta?.target as string[])?.join(", ") || "field";
      res.status(409).json({
        error: {
          code: "DB_UNIQUE_VIOLATION",
          message: `A record with this ${target} already exists.`,
          details: env.NODE_ENV === "development" ? err.meta : undefined,
        },
      });
      return;
    }
    if (err.code === "P2003") {
      res.status(404).json({
        error: {
          code: "RESOURCE_NOT_FOUND",
          message:
            "A referenced record (e.g. exam or candidate user) does not exist in the database.",
          details: env.NODE_ENV === "development" ? err.meta : undefined,
        },
      });
      return;
    }
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    res.status(503).json({
      error: {
        code: "DB_UNAVAILABLE",
        message:
          "Database server is unreachable. Please make sure PostgreSQL is running and DATABASE_URL is valid.",
        details: env.NODE_ENV === "development" ? err.message : undefined,
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
