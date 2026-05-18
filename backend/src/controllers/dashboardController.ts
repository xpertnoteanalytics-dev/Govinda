import { Request, Response, NextFunction } from "express";
import * as dashboardService from "../services/dashboardService";

export async function analytics(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = await dashboardService.getTenantAnalytics(req.tenantId!);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
