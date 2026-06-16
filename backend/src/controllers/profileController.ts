// src/controllers/profileController.ts
import { Request, Response, NextFunction } from "express";
import * as profileService from "../services/profileService";
import { Tenant } from "../models";
import { resolveObjectIdString } from "../utils/resolveId";

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

export async function updateOrganization(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { logo } = req.body;

    if (!logo || typeof logo !== "string") {
      res.status(400).json({ success: false, error: { message: "Logo is required" } });
      return;
    }

    // Validate it's a base64 image
    if (!logo.startsWith("data:image/")) {
      res.status(400).json({ success: false, error: { message: "Invalid image format" } });
      return;
    }

    // Limit size ~2MB base64
    if (logo.length > 2_800_000) {
      res.status(400).json({ success: false, error: { message: "Image too large. Max 2MB." } });
      return;
    }

    const tenant = await Tenant.findByIdAndUpdate(
      resolveObjectIdString(req.tenantId!, "tenantId"),
      { $set: { logo } },
      { new: true }
    );

    if (!tenant) {
      res.status(404).json({ success: false, error: { message: "Organization not found" } });
      return;
    }

    res.json({ success: true, data: { logo: tenant.logo } });
  } catch (err) {
    next(err);
  }
}

export async function getOrganization(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenant = await Tenant.findById(
      resolveObjectIdString(req.tenantId!, "tenantId")
    ).select("name slug plan logo");

    res.json({ success: true, data: { tenant } });
  } catch (err) {
    next(err);
  }
}