// src/services/profileService.ts
//
// Profile read/update logic.
// Every Tenant populate MUST include `logo` — it drives the sidebar org badge.

import { User } from "../models";
import { AppError } from "../utils/AppError";
import type { AuthUserResponse } from "./authService";

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
}

// ── Shared tenant shape ────────────────────────────────────────────────────────

type PopulatedTenant = {
  _id: { toString(): string };
  name: string;
  slug: string;
  plan: string;
  logo?: string | null;
};

function tenantToSummary(t: PopulatedTenant) {
  return {
    id: t._id.toString(),
    name: t.name,
    slug: t.slug,
    plan: t.plan,
    logo: t.logo ?? null,   // always null, never undefined
  };
}

// ── getProfile ─────────────────────────────────────────────────────────────────

export async function getProfile(userId: string): Promise<AuthUserResponse> {
  const user = await User.findById(userId).populate(
    "tenantId",
    // ← `logo` is mandatory here — it renders the org logo in sidebar/profile
    "name slug plan isActive logo"
  );

  if (!user || !user.isActive) {
    throw new AppError(404, "User not found", "USER_NOT_FOUND");
  }

  const tenant = user.tenantId as unknown as PopulatedTenant;

  return {
    id: user._id.toString(),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    tenantId: tenant._id.toString(),
    tenant: tenantToSummary(tenant),
  };
}

// ── updateProfile ──────────────────────────────────────────────────────────────

export async function updateProfile(
  userId: string,
  tenantId: string,
  input: UpdateProfileInput
): Promise<AuthUserResponse> {
  const user = await User.findOneAndUpdate(
    { _id: userId, tenantId },
    {
      ...(input.firstName && { firstName: input.firstName.trim() }),
      ...(input.lastName && { lastName: input.lastName.trim() }),
    },
    { new: true, runValidators: true }
  ).populate(
    "tenantId",
    // ← same as above — never omit `logo`
    "name slug plan isActive logo"
  );

  if (!user) {
    throw new AppError(404, "User not found", "USER_NOT_FOUND");
  }

  const tenant = user.tenantId as unknown as PopulatedTenant;

  return {
    id: user._id.toString(),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    tenantId: tenant._id.toString(),
    tenant: tenantToSummary(tenant),
  };
}