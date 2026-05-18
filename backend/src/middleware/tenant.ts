import { Request, Response, NextFunction } from "express";
import { Tenant } from "../models";
import { AppError } from "../utils/AppError";
import { ROLES } from "../types/roles";

/**
 * Ensures the authenticated user can only access resources within their tenant.
 * Super admins may pass an optional X-Tenant-Id header to impersonate a tenant.
 */
export function enforceTenantScope(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    return next(new AppError(401, "Authentication required", "UNAUTHORIZED"));
  }

  const headerTenantId = req.headers["x-tenant-id"] as string | undefined;

  if (req.user.role === ROLES.SUPER_ADMIN && headerTenantId) {
    req.tenantId = headerTenantId;
    return next();
  }

  req.tenantId = req.user.tenantId;
  next();
}

/**
 * Validates tenant exists and is active (for routes that include :tenantId param).
 */
export async function resolveTenant(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const tenantId = (req.params.tenantId as string) ?? req.tenantId;

  if (!tenantId) {
    return next(new AppError(400, "Tenant context required", "TENANT_REQUIRED"));
  }

  if (req.user && req.user.role !== ROLES.SUPER_ADMIN && tenantId !== req.user.tenantId) {
    return next(new AppError(403, "Access denied for this organization", "TENANT_FORBIDDEN"));
  }

  const tenant = await Tenant.findById(tenantId);
  if (!tenant || !tenant.isActive) {
    return next(new AppError(404, "Organization not found", "TENANT_NOT_FOUND"));
  }

  req.tenantId = tenant._id.toString();
  next();
}
