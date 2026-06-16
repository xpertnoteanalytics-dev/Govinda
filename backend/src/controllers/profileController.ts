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

// ── updateOrganization ────────────────────────────────────────────────────────
//
// PATCH /v1/organization
// Body: { logo: string }  → set logo
//       { logo: null }    → remove logo
//
// The logo field is the organization's OWN dynamic logo.
// The Govinda AI product logo is a static frontend asset — it never goes
// through this endpoint and is never stored per-tenant.

export async function updateOrganization(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { logo } = req.body as { logo: string | null };

    // Allow explicit null to clear the logo
    if (logo !== null) {
      if (typeof logo !== "string") {
        res
          .status(400)
          .json({ success: false, error: { message: "Logo must be a string or null" } });
        return;
      }
      if (!logo.startsWith("data:image/")) {
        res
          .status(400)
          .json({ success: false, error: { message: "Invalid image format. Must be a data-URL." } });
        return;
      }
      // ~2 MB base64 upper bound
      if (logo.length > 2_800_000) {
        res
          .status(400)
          .json({ success: false, error: { message: "Image too large. Max 2 MB." } });
        return;
      }
    }

    const tenant = await Tenant.findByIdAndUpdate(
      resolveObjectIdString(req.tenantId!, "tenantId"),
      // $set with null explicitly clears the field; Mongoose respects this
      { $set: { logo: logo ?? null } },
      { new: true }
    );

    if (!tenant) {
      res
        .status(404)
        .json({ success: false, error: { message: "Organization not found" } });
      return;
    }

    res.json({ success: true, data: { logo: tenant.logo ?? null } });
  } catch (err) {
    next(err);
  }
}

// ── getOrganization ───────────────────────────────────────────────────────────
//
// GET /v1/organization
// Returns org metadata including logo for clients that need a fresh fetch.

export async function getOrganization(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenant = await Tenant.findById(
      resolveObjectIdString(req.tenantId!, "tenantId")
    ).select("name slug plan logo");   // ← `logo` must be selected here

    if (!tenant) {
      res
        .status(404)
        .json({ success: false, error: { message: "Organization not found" } });
      return;
    }

    res.json({
      success: true,
      data: {
        tenant: {
          id: tenant._id.toString(),
          name: tenant.name,
          slug: tenant.slug,
          plan: tenant.plan,
          logo: tenant.logo ?? null,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}