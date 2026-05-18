import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";
import { ROLE_HIERARCHY, type Role } from "../types/roles";

export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError(401, "Authentication required", "UNAUTHORIZED"));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError(403, "Insufficient permissions", "FORBIDDEN"));
    }

    next();
  };
}

export function requireMinRole(minimumRole: Role) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError(401, "Authentication required", "UNAUTHORIZED"));
    }

    const userLevel = ROLE_HIERARCHY[req.user.role] ?? 0;
    const requiredLevel = ROLE_HIERARCHY[minimumRole] ?? 0;

    if (userLevel < requiredLevel) {
      return next(new AppError(403, "Insufficient permissions", "FORBIDDEN"));
    }

    next();
  };
}
