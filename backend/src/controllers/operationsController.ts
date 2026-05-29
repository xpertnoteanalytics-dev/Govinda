import { Request, Response, NextFunction } from "express";
import * as operationsAnalyticsService from "../services/operationsAnalyticsService";
import { getCompanyOutreachConfig } from "../services/companyOutreach";

export async function outreachConfig(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    res.json({ success: true, data: getCompanyOutreachConfig() });
  } catch (err) {
    next(err);
  }
}

export async function overview(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = await operationsAnalyticsService.getOperationsOverview(
      req.tenantId!,
      req.user!.id
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
