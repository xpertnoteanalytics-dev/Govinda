import { User } from "../models";
import { AppError } from "../utils/AppError";
import type { AuthUserResponse } from "./authService";

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
}

export async function getProfile(userId: string): Promise<AuthUserResponse> {
  const user = await User.findById(userId).populate(
    "tenantId",
    "name slug plan isActive"
  );

  if (!user || !user.isActive) {
    throw new AppError(404, "User not found", "USER_NOT_FOUND");
  }

  const tenant = user.tenantId as unknown as {
    _id: { toString(): string };
    name: string;
    slug: string;
    plan: string;
  };

  return {
    id: user._id.toString(),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    tenantId: tenant._id.toString(),
    tenant: {
      id: tenant._id.toString(),
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
    },
  };
}

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
  ).populate("tenantId", "name slug plan isActive");

  if (!user) {
    throw new AppError(404, "User not found", "USER_NOT_FOUND");
  }

  const tenant = user.tenantId as unknown as {
    _id: { toString(): string };
    name: string;
    slug: string;
    plan: string;
  };

  return {
    id: user._id.toString(),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    tenantId: tenant._id.toString(),
    tenant: {
      id: tenant._id.toString(),
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
    },
  };
}
