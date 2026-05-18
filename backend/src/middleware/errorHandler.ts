import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";
import { env } from "../config/env";

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(404, `Route not found: ${req.method} ${req.path}`));
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        code: err.code,
      },
    });
    return;
  }

  if (err.name === "ValidationError") {
    res.status(400).json({
      success: false,
      error: { message: err.message, code: "VALIDATION_ERROR" },
    });
    return;
  }

  console.error("[error]", err);

  res.status(500).json({
    success: false,
    error: {
      message: env.isProduction ? "Internal server error" : err.message,
      code: "INTERNAL_ERROR",
    },
  });
}
