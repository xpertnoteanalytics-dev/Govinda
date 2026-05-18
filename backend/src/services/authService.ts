import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Tenant, User } from "../models";
import { ROLES } from "../types/roles";
import { AppError } from "../utils/AppError";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt";

const SALT_ROUNDS = 12;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = slugify(base);
  let suffix = 0;

  while (await Tenant.exists({ slug })) {
    suffix += 1;
    slug = `${slugify(base)}-${suffix}`;
  }

  return slug;
}

function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
    plan: string;
  };
}

export async function registerUser(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationName: string;
}): Promise<{ user: AuthUserResponse; tokens: AuthTokens }> {
  const existing = await User.findOne({ email: input.email });
  if (existing) {
    throw new AppError(409, "An account with this email already exists", "EMAIL_EXISTS");
  }

  const slug = await uniqueSlug(input.organizationName);

  const tenant = await Tenant.create({
    name: input.organizationName,
    slug,
    plan: "free",
  });

  const hashedPassword = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await User.create({
    email: input.email,
    password: hashedPassword,
    firstName: input.firstName,
    lastName: input.lastName,
    role: ROLES.TENANT_ADMIN,
    tenantId: tenant._id,
  });

  const tokens = await issueTokens(user);
  return {
    user: formatAuthUser(user, tenant),
    tokens,
  };
}

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<{ user: AuthUserResponse; tokens: AuthTokens }> {
  const user = await User.findOne({ email: input.email })
    .select("+password +refreshTokenHash")
    .populate<{ tenantId: { _id: unknown; name: string; slug: string; plan: string } }>(
      "tenantId",
      "name slug plan isActive"
    );

  if (!user || !user.isActive) {
    throw new AppError(401, "Invalid email or password", "INVALID_CREDENTIALS");
  }

  const tenant = user.tenantId as unknown as {
    _id: { toString(): string };
    name: string;
    slug: string;
    plan: string;
    isActive?: boolean;
  };

  if (tenant && "isActive" in tenant && tenant.isActive === false) {
    throw new AppError(403, "Organization account is suspended", "TENANT_SUSPENDED");
  }

  const passwordMatch = await bcrypt.compare(input.password, user.password);
  if (!passwordMatch) {
    throw new AppError(401, "Invalid email or password", "INVALID_CREDENTIALS");
  }

  user.lastLoginAt = new Date();
  const tokens = await issueTokens(user);
  await user.save();

  return {
    user: formatAuthUser(user, tenant),
    tokens,
  };
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<AuthTokens> {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(401, "Invalid refresh token", "INVALID_REFRESH_TOKEN");
  }

  const user = await User.findById(payload.sub).select("+refreshTokenHash");
  if (!user || !user.isActive || !user.refreshTokenHash) {
    throw new AppError(401, "Invalid refresh token", "INVALID_REFRESH_TOKEN");
  }

  const tokenHash = hashRefreshToken(refreshToken);
  if (tokenHash !== user.refreshTokenHash) {
    throw new AppError(401, "Refresh token revoked", "REFRESH_TOKEN_REVOKED");
  }

  return issueTokens(user);
}

export async function logoutUser(userId: string): Promise<void> {
  await User.findByIdAndUpdate(userId, { $unset: { refreshTokenHash: 1 } });
}

async function issueTokens(user: {
  _id: { toString(): string };
  email: string;
  role: string;
  tenantId: { toString(): string };
}): Promise<AuthTokens> {
  const tenantId =
    typeof user.tenantId === "object" && user.tenantId !== null
      ? user.tenantId.toString()
      : String(user.tenantId);

  const accessToken = signAccessToken({
    sub: user._id.toString(),
    email: user.email,
    role: user.role as import("../types/roles").Role,
    tenantId,
  });

  const refreshToken = signRefreshToken({
    sub: user._id.toString(),
    tenantId,
  });

  const refreshTokenHash = hashRefreshToken(refreshToken);
  await User.findByIdAndUpdate(user._id, { refreshTokenHash });

  return { accessToken, refreshToken };
}

function formatAuthUser(
  user: {
    _id: { toString(): string };
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    tenantId: { toString(): string } | { _id: { toString(): string }; name: string; slug: string; plan: string };
  },
  tenant: { _id?: { toString(): string }; name: string; slug: string; plan: string; toString?: () => string }
): AuthUserResponse {
  const tenantId =
    tenant._id?.toString() ??
    (typeof user.tenantId === "object" && "toString" in user.tenantId
      ? user.tenantId.toString()
      : String(user.tenantId));

  return {
    id: user._id.toString(),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    tenantId,
    tenant: {
      id: tenantId,
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
    },
  };
}

export async function getCurrentUser(userId: string): Promise<AuthUserResponse> {
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

  return formatAuthUser(user, tenant);
}
