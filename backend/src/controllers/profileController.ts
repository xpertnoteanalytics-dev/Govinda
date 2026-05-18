import { Request, Response, NextFunction } from "express";
import * as profileService from "../services/profileService";

export async function getProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await profileService.getProfile(req.user!.id);
    res.json({ success: true, data: { user } });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await profileService.updateProfile(
      req.user!.id,
      req.tenantId!,
      req.body
    );
    res.json({ success: true, data: { user } });
  } catch (err) {
    next(err);
  }
}
