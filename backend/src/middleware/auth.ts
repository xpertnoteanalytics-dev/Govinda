import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";
import { verifyAccessToken } from "../utils/jwt";
import { isValidObjectIdString } from "../utils/resolveId";
import type { Role } from "../types/roles";

export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return next(new AppError(401, "Authentication required", "UNAUTHORIZED"));
  }

  const token = header.slice(7);

  try {
    const payload = verifyAccessToken(token);

    if (!isValidObjectIdString(payload.tenantId) || !isValidObjectIdString(payload.sub)) {
      return next(
        new AppError(401, "Invalid session. Please sign in again.", "INVALID_SESSION")
      );
    }

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role as Role,
      tenantId: payload.tenantId,
    };
    req.tenantId = payload.tenantId;
    next();
  } catch {
    next(new AppError(401, "Invalid or expired token", "INVALID_TOKEN"));
  }
}

export function optionalAuthenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return next();
  }

  const token = header.slice(7);

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role as Role,
      tenantId: payload.tenantId,
    };
    req.tenantId = payload.tenantId;
  } catch {
    // ignore invalid token for optional auth
  }

  next();
}
